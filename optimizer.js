(function () {
    var budgetEl  = document.getElementById('budget-select');
    var dirEl     = document.getElementById('direction-select');
    var metricEl  = document.getElementById('metric-select');
    var dir2El    = document.getElementById('direction2-select');
    var metric2El = document.getElementById('metric2-select');
    var grid      = document.getElementById('menu-grid');
    var noResults = document.getElementById('no-results');
    var summaryEl = document.getElementById('optimizer-summary');
    var dietRadios = document.querySelectorAll('input[name="diet"]');

    // Populate budget dropdown ($1–$100)
    for (var i = 1; i <= 100; i++) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = '$' + i;
        budgetEl.appendChild(opt);
    }

    // Parse menu cards once on load
    var cards = Array.from(grid.children);
    var originalOrder = cards.slice();

    var items = cards.map(function (card) {
        var dietStr = (card.dataset.diet || '').toLowerCase();
        return {
            el:       card,
            cents:    Math.round(parseFloat(card.dataset.price) * 100),
            price:    parseFloat(card.dataset.price),
            calories: parseInt(card.dataset.calories, 10) || 0,
            protein:  parseInt(card.dataset.protein, 10)  || 0,
            carbs:    parseInt(card.dataset.carbs, 10)     || 0,
            diets:    dietStr ? dietStr.split(',') : [],
            isHotdog: card.dataset.hotdog === 'true'
        };
    });

    function getSelectedDiet() {
        var checked = document.querySelector('input[name="diet"]:checked');
        return checked ? checked.value : '';
    }

    function itemMatchesDiet(item, diet) {
        if (!diet) return true;
        if (diet === 'glizzygarian') return item.isHotdog;
        return item.diets.indexOf(diet) !== -1;
    }

    function metricValue(item, metric) {
        if (metric === 'items') return 1;
        return item[metric] || 0;
    }

    /**
     * Unbounded knapsack DP.
     * direction = "most"  → maximize metric within budget
     * direction = "least" → minimize metric while spending as much budget as possible
     * Only considers items that match the current diet filter.
     */
    function solveKnapsack(budgetCents, metric, direction, diet) {
        var W = budgetCents;

        // Build filtered item list
        var filtered = [];
        var indexMap = []; // maps filtered index back to items[] index
        for (var fi = 0; fi < items.length; fi++) {
            if (itemMatchesDiet(items[fi], diet)) {
                filtered.push(items[fi]);
                indexMap.push(fi);
            }
        }

        var n = filtered.length;
        var counts = new Array(items.length).fill(0);

        if (n === 0) return counts;

        if (direction === 'most') {
            var dp     = new Array(W + 1).fill(0);
            var choice = new Int32Array(W + 1).fill(-1);

            for (var w = 0; w <= W; w++) {
                for (var i = 0; i < n; i++) {
                    var c = filtered[i].cents;
                    var v = metricValue(filtered[i], metric);
                    if (v <= 0) continue;
                    if (c <= w && dp[w - c] + v > dp[w]) {
                        dp[w] = dp[w - c] + v;
                        choice[w] = i;
                    }
                }
            }

            var cap = W;
            while (cap > 0 && choice[cap] !== -1) {
                counts[indexMap[choice[cap]]]++;
                cap -= filtered[choice[cap]].cents;
            }
        } else {
            var dp2     = new Array(W + 1).fill(Infinity);
            var choice2 = new Int32Array(W + 1).fill(-1);
            dp2[0] = 0;

            for (var w2 = 0; w2 <= W; w2++) {
                if (dp2[w2] === Infinity) continue;
                for (var j = 0; j < n; j++) {
                    var c2 = filtered[j].cents;
                    var v2 = metricValue(filtered[j], metric);
                    var next = w2 + c2;
                    if (next <= W && dp2[w2] + v2 < dp2[next]) {
                        dp2[next] = dp2[w2] + v2;
                        choice2[next] = j;
                    }
                }
            }

            var best = -1;
            for (var s = W; s >= 0; s--) {
                if (dp2[s] !== Infinity && s > 0) { best = s; break; }
            }

            if (best > 0) {
                var rem = best;
                while (rem > 0 && choice2[rem] !== -1) {
                    counts[indexMap[choice2[rem]]]++;
                    rem -= filtered[choice2[rem]].cents;
                }
            }
        }

        return counts;
    }

    /**
     * Lexicographic bi-objective knapsack (unbounded).
     * Maximizes the primary metric first, then uses the secondary metric as a
     * tiebreaker (dir2 = 'fewest' → minimize; dir2 = 'most' → maximize).
     * Only applies when direction is 'most'.
     */
    function solveKnapsackBiObjective(budgetCents, metric, dir2, metric2, diet) {
        var W = budgetCents;

        var filtered = [];
        var indexMap = [];
        for (var fi = 0; fi < items.length; fi++) {
            if (itemMatchesDiet(items[fi], diet)) {
                filtered.push(items[fi]);
                indexMap.push(fi);
            }
        }

        var n = filtered.length;
        var counts = new Array(items.length).fill(0);
        if (n === 0) return counts;

        // dp[w] = { prim: max primary metric, sec: best secondary at that primary }
        // Baseline: buy nothing → both metrics = 0
        var dp = [];
        for (var w0 = 0; w0 <= W; w0++) {
            dp.push({ prim: 0, sec: 0 });
        }

        var choice = new Int32Array(W + 1).fill(-1);

        for (var w = 0; w <= W; w++) {
            for (var i = 0; i < n; i++) {
                var c = filtered[i].cents;
                if (c > w) continue;
                var v  = metricValue(filtered[i], metric);
                var v2 = metricValue(filtered[i], metric2);
                if (v <= 0) continue;

                var newPrim = dp[w - c].prim + v;
                var newSec  = dp[w - c].sec  + v2;

                var better = false;
                if (newPrim > dp[w].prim) {
                    better = true;
                } else if (newPrim === dp[w].prim && dp[w].prim > 0) {
                    if (dir2 === 'fewest' && newSec < dp[w].sec) better = true;
                    else if (dir2 === 'most' && newSec > dp[w].sec) better = true;
                }

                if (better) {
                    dp[w].prim = newPrim;
                    dp[w].sec  = newSec;
                    choice[w]  = i;
                }
            }
        }

        var cap = W;
        while (cap > 0 && choice[cap] !== -1) {
            counts[indexMap[choice[cap]]]++;
            cap -= filtered[choice[cap]].cents;
        }

        return counts;
    }

    function optimize() {
        var budget    = parseFloat(budgetEl.value);
        var direction = dirEl.value;
        var metric    = metricEl.value;
        var dir2      = dir2El.value;
        var metric2   = metric2El.value;
        var diet      = getSelectedDiet();

        // Easter egg: $1 + any direction + nutrition metric
        if (budget === 1 && (direction === 'most' || direction === 'least') &&
                (metric === 'calories' || metric === 'protein' || metric === 'carbs')) {
            brokeBallModal.classList.remove('hidden');
            brokeBallClose.focus();
            return;
        }

        // Remove any existing qty badges
        grid.querySelectorAll('.qty-badge').forEach(function (b) { b.remove(); });

        // Reset cards to original state
        items.forEach(function (item) {
            item.el.style.display = '';
            item.el.classList.remove('relative');
        });

        // If dropdowns incomplete, apply diet filter only (no optimizer)
        if (!budget || !direction || !metric) {
            originalOrder.forEach(function (card) { grid.appendChild(card); });
            noResults.classList.add('hidden');
            summaryEl.classList.add('hidden');

            // Still apply diet filter to show/hide cards
            if (diet) {
                var anyVisible = false;
                items.forEach(function (item) {
                    if (itemMatchesDiet(item, diet)) {
                        item.el.style.display = '';
                        anyVisible = true;
                    } else {
                        item.el.style.display = 'none';
                    }
                });
                if (!anyVisible) {
                    noResults.classList.remove('hidden');
                    noResults.textContent = 'No items match that diet!';
                }
            }
            return;
        }

        noResults.textContent = 'No items fit that budget!';
        var budgetCents = Math.round(budget * 100);
        var useBiObjective = direction === 'most' && dir2 && metric2;
        var counts = useBiObjective
            ? solveKnapsackBiObjective(budgetCents, metric, dir2, metric2, diet)
            : solveKnapsack(budgetCents, metric, direction, diet);

        var totalCount = counts.reduce(function (a, b) { return a + b; }, 0);

        if (totalCount === 0) {
            items.forEach(function (item) { item.el.style.display = 'none'; });
            noResults.classList.remove('hidden');
            summaryEl.classList.add('hidden');
            originalOrder.forEach(function (card) { grid.appendChild(card); });
            return;
        }

        noResults.classList.add('hidden');

        var totalCents     = 0;
        var totalMetric    = 0;
        var totalSecondary = 0;
        var selectedCards  = [];
        var hiddenCards    = [];

        items.forEach(function (item, i) {
            if (counts[i] > 0) {
                item.el.style.display = '';
                item.el.classList.add('relative');

                var badge = document.createElement('div');
                badge.className = 'qty-badge';
                badge.textContent = 'x' + counts[i];
                item.el.prepend(badge);

                totalCents     += counts[i] * item.cents;
                totalMetric    += counts[i] * metricValue(item, metric);
                if (useBiObjective) totalSecondary += counts[i] * metricValue(item, metric2);
                selectedCards.push(item.el);
            } else {
                item.el.style.display = 'none';
                hiddenCards.push(item.el);
            }
        });

        selectedCards.concat(hiddenCards).forEach(function (card) {
            grid.appendChild(card);
        });

        var spent     = (totalCents / 100).toFixed(2);
        var remaining = ((budgetCents - totalCents) / 100).toFixed(2);
        var metricLabel = metric === 'items' ? 'items' : metric;
        var metricUnit  = metric === 'calories' ? ' cal' : (metric === 'items' ? '' : 'g');
        var metricDisp  = totalMetric + metricUnit + ' ' + metricLabel;

        var secondaryDisp = '';
        if (useBiObjective) {
            var sec2Unit  = metric2 === 'calories' ? ' cal' : (metric2 === 'items' ? '' : 'g');
            secondaryDisp = ' | ' + totalSecondary + sec2Unit + ' ' + metric2;
        }

        summaryEl.textContent = '— ' + totalCount + ' item' + (totalCount !== 1 ? 's' : '') +
            ' | ' + metricDisp +
            secondaryDisp +
            ' | Total $' + spent +
            ' | $' + remaining + ' remaining';
        summaryEl.classList.remove('hidden');
    }

    // Easter egg: broke baller ($1 + nutrition metric)
    var brokeBallModal  = document.getElementById('broke-baller-modal');
    var brokeBallClose  = document.getElementById('broke-baller-close');
    if (brokeBallClose) {
        brokeBallClose.addEventListener('click', function () {
            brokeBallModal.classList.add('hidden');
            window.resetOptimizer();
        });
    }

    // Easter egg: $100 bill rejected
    var bigBillModal = document.getElementById('big-bill-modal');
    var bigBillClose = document.getElementById('big-bill-close');
    if (bigBillClose) {
        bigBillClose.addEventListener('click', function () {
            bigBillModal.classList.add('hidden');
            window.resetOptimizer();
        });
    }

    budgetEl.addEventListener('change', function () {
        if (budgetEl.value === '100') {
            bigBillModal.classList.remove('hidden');
            bigBillClose.focus();
            return;
        }
        optimize();
    });
    dirEl.addEventListener('change', optimize);
    metricEl.addEventListener('change', optimize);
    dir2El.addEventListener('change', optimize);
    metric2El.addEventListener('change', optimize);
    dietRadios.forEach(function (radio) {
        radio.addEventListener('change', optimize);
    });

    window.resetOptimizer = function () {
        budgetEl.value  = '';
        dirEl.value     = '';
        metricEl.value  = '';
        dir2El.value    = '';
        metric2El.value = '';
        var allRadio = document.querySelector('input[name="diet"][value=""]');
        if (allRadio) allRadio.checked = true;
        optimize();
    };
})();

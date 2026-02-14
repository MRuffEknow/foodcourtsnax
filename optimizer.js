(function () {
    var budgetEl  = document.getElementById('budget-select');
    var dirEl     = document.getElementById('direction-select');
    var metricEl  = document.getElementById('metric-select');
    var grid      = document.getElementById('menu-grid');
    var noResults = document.getElementById('no-results');
    var summaryEl = document.getElementById('optimizer-summary');

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
        return {
            el:       card,
            cents:    Math.round(parseFloat(card.dataset.price) * 100),
            price:    parseFloat(card.dataset.price),
            calories: parseInt(card.dataset.calories, 10) || 0,
            protein:  parseInt(card.dataset.protein, 10)  || 0,
            carbs:    parseInt(card.dataset.carbs, 10)     || 0
        };
    });

    function metricValue(item, metric) {
        if (metric === 'items') return 1;
        return item[metric] || 0;
    }

    /**
     * Unbounded knapsack DP.
     * direction = "most"  → maximize metric within budget
     * direction = "least" → minimize metric while spending as much budget as possible
     */
    function solveKnapsack(budgetCents, metric, direction) {
        var W = budgetCents;
        var n = items.length;
        var counts = new Array(n).fill(0);

        if (direction === 'most') {
            // dp[w] = max metric value achievable with exactly w cents capacity
            var dp     = new Array(W + 1).fill(0);
            var choice = new Int32Array(W + 1).fill(-1);

            for (var w = 0; w <= W; w++) {
                for (var i = 0; i < n; i++) {
                    var c = items[i].cents;
                    var v = metricValue(items[i], metric);
                    if (v <= 0) continue; // skip zero-value items
                    if (c <= w && dp[w - c] + v > dp[w]) {
                        dp[w] = dp[w - c] + v;
                        choice[w] = i;
                    }
                }
            }

            // Backtrack from W
            var cap = W;
            while (cap > 0 && choice[cap] !== -1) {
                counts[choice[cap]]++;
                cap -= items[choice[cap]].cents;
            }
        } else {
            // "least" — minimize metric while spending as much as possible
            var dp2     = new Array(W + 1).fill(Infinity);
            var choice2 = new Int32Array(W + 1).fill(-1);
            dp2[0] = 0;

            for (var w2 = 0; w2 <= W; w2++) {
                if (dp2[w2] === Infinity) continue;
                for (var j = 0; j < n; j++) {
                    var c2 = items[j].cents;
                    var v2 = metricValue(items[j], metric);
                    var next = w2 + c2;
                    if (next <= W && dp2[w2] + v2 < dp2[next]) {
                        dp2[next] = dp2[w2] + v2;
                        choice2[next] = j;
                    }
                }
            }

            // Find highest spend with a valid (non-Infinity) solution
            var best = -1;
            for (var s = W; s >= 0; s--) {
                if (dp2[s] !== Infinity && s > 0) { best = s; break; }
            }

            if (best > 0) {
                var rem = best;
                while (rem > 0 && choice2[rem] !== -1) {
                    counts[choice2[rem]]++;
                    rem -= items[choice2[rem]].cents;
                }
            }
        }

        return counts;
    }

    function optimize() {
        var budget    = parseFloat(budgetEl.value);
        var direction = dirEl.value;
        var metric    = metricEl.value;

        // Remove any existing qty badges
        grid.querySelectorAll('.qty-badge').forEach(function (b) { b.remove(); });

        // Reset cards to original state
        items.forEach(function (item) {
            item.el.style.display = '';
            item.el.classList.remove('relative');
        });

        // If dropdowns incomplete, show all cards in original order
        if (!budget || !direction || !metric) {
            originalOrder.forEach(function (card) { grid.appendChild(card); });
            noResults.classList.add('hidden');
            summaryEl.classList.add('hidden');
            return;
        }

        var budgetCents = Math.round(budget * 100);
        var counts = solveKnapsack(budgetCents, metric, direction);

        var totalCount = counts.reduce(function (a, b) { return a + b; }, 0);

        if (totalCount === 0) {
            items.forEach(function (item) { item.el.style.display = 'none'; });
            noResults.classList.remove('hidden');
            summaryEl.classList.add('hidden');
            // Keep original order for DOM
            originalOrder.forEach(function (card) { grid.appendChild(card); });
            return;
        }

        noResults.classList.add('hidden');

        // Calculate totals and apply badges
        var totalCents    = 0;
        var totalMetric   = 0;
        var selectedCards = [];
        var hiddenCards   = [];

        items.forEach(function (item, i) {
            if (counts[i] > 0) {
                item.el.style.display = '';
                item.el.classList.add('relative');

                var badge = document.createElement('div');
                badge.className = 'qty-badge';
                badge.textContent = 'x' + counts[i];
                item.el.prepend(badge);

                totalCents  += counts[i] * item.cents;
                totalMetric += counts[i] * metricValue(item, metric);
                selectedCards.push(item.el);
            } else {
                item.el.style.display = 'none';
                hiddenCards.push(item.el);
            }
        });

        // Reorder DOM: selected first (preserve relative order), hidden last
        selectedCards.concat(hiddenCards).forEach(function (card) {
            grid.appendChild(card);
        });

        // Build summary
        var spent     = (totalCents / 100).toFixed(2);
        var remaining = ((budgetCents - totalCents) / 100).toFixed(2);
        var metricLabel = metric === 'items' ? 'items' : metric;
        var metricUnit  = metric === 'calories' ? ' cal' : (metric === 'items' ? '' : 'g');
        var metricDisp  = totalMetric + metricUnit + ' ' + metricLabel;

        summaryEl.textContent = '— ' + totalCount + ' item' + (totalCount !== 1 ? 's' : '') +
            ' | ' + metricDisp +
            ' | Total $' + spent +
            ' | $' + remaining + ' remaining';
        summaryEl.classList.remove('hidden');
    }

    budgetEl.addEventListener('change', optimize);
    dirEl.addEventListener('change', optimize);
    metricEl.addEventListener('change', optimize);
})();

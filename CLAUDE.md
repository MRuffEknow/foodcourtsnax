# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Food Court Snax" — a static single-page menu site styled as an anime-themed wholesale food court. The entire app is one `index.html` file with no build step, no package manager, and no framework.

## Development

Open `index.html` directly in a browser. No build or install commands needed.

## Architecture

- **Styling**: Tailwind CSS loaded via CDN (`cdn.tailwindcss.com`) with inline config extending colors, fonts, and shadows
- **Fonts**: Google Fonts (Inter for body, Oswald for prices, Material Symbols for icons)
- **Dark mode**: Uses Tailwind's `class` strategy with `dark:` variants throughout
- **Interactive elements**: CSS-only flip cards (hover-triggered 3D transforms via `perspective` and `backface-visibility`) — no JavaScript beyond Tailwind config

## Design System

- **Primary color** (`#005697`): "Warehouse Blue" — used for borders, headings, footer
- **Secondary color** (`#E31837`): "Price Tag Red" — used for price tags, accents, CTAs
- **Shadow**: `shadow-retro` (4px solid offset) gives the brutalist/warehouse look
- **Price tags**: Skewed overlays using `skew-x-[-10deg]` with Oswald font

## Menu Item Pattern

Each menu card follows a repeating structure: a `group` wrapper containing a `flip-card-inner` div with front (image + name + price) and back (nutrition facts + allergen badge). To add a new item, duplicate an existing card block and update the image, name, price, description, nutrition data, and allergen tag.

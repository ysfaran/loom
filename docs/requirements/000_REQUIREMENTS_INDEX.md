# Loom Reimplementation Requirements Index

## Vision 

Loom’s vision is to make documentation feel like a living product, not a fixed template.

It starts from a simple idea: every team should be able to shape the experience around their own way of working. Some teams need lightweight docs, others need rich workflows like architecture decision tracking or AI-assisted knowledge access. Loom is designed so both can exist naturally.

Instead of forcing one “right” structure, Loom is built around composition. You begin with a basic experience and then grow it in clear, intentional building blocks. As needs evolve, the documentation experience can evolve with them.

The goal is consistency without rigidity: one coherent model that stays approachable for small projects while remaining open-ended for advanced teams.

## General Idea
This folder is the source of truth for rebuilding Loom from scratch.

Requirements are defined incrementally. Each requirement should be complete and implementation-ready on its own, while still fitting a plugin-first vision for the whole product.

For now, this reimplementation scope intentionally includes only the first two requirements:
- core CLI + config + plugin registration/contract validation
- first renderer implementation (React + Vite + MDX/MD + Tailwind)

This folder uses numbered requirement stories. Each story includes:
- User story
- Acceptance criteria
- Technical details

## Stories
- `001_PRODUCT_SCOPE_AND_GOALS.md`
- `002_PLUGIN_FIRST_ARCHITECTURE.md`

## Future Stories
Additional stories will be added after these two are finalized.

# Dependency Diagrams: How and Why?

Why is issue #345 "frob the blizzr" on this release?  
It _should_ be in support of some user story or bug fix.

How are we going to do #545 "fly to moon"?  
We break it down into parts.

Dependency diagrams can help answer these _how_ and _why_ questions.

## Getting Started

```
yarn
yarn start
```

## Deployment

```
yarn build
```

The copy the `dist/` folder to netlify or whatever.

## Dev Notes: Powered By...

- [Graphviz](https://graphviz.org/)
- [d3-graphviz](https://www.npmjs.com/package/d3-graphviz)
- [Preact](https://preactjs.com/)
- [Parcel](https://parceljs.org/)

# Rocket Scripts

Here we have main script sources to be used in WP Rocket plugin repository.

`dist` directory contains the final build files.

## Scripts/Commands

```
npm run build:unmin
```

This is to build the source files without minification.

```
npm run build:min
```

This is to build the minified version of the source files.

```
npm run build
```

This is to build both minified and not minified versions.

## How to test a change in WP Rocket plugin

1. Create a branch and PR for your change in this repository.
2. Edit `package.json` inside WP Rocket plugin repository to have the following line:
```
"wp-rocket-scripts": "github:wp-media/rocket-scripts#branch-name",
```
3. Remove `node_modules` directory and `package-lock.json` file.
4. Run the command
```
npm install
```
5. Use the gulp task there to generate the beacon script:
```
npm run gulp build:js:beacon
```
6. This will update the beacon script with the corresponding branch changes.

## How to release
1. Update the version in `package.json`
2. Make sure everything is merged into `trunk` branch.
3. Create a release from `trunk`
4. Github Workflow will run to release into npm.
5. In WP Rocket or any other code that uses this package can update the version in their `package.json` and run `npm install` again.
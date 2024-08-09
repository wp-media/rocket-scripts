# Rocket Scripts

Here we have main script sources to be used in WP Rocket plugin repository.

## Building

`dist` directory contains the final build files.

Developments for the scripts are done in the `src` folder. To update the outputs in the dist folder

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

# Updating WP Rocket

## How to import changes from rocket-scripts

The following steps must be followed when you need to test a new version of the scripts within WP Rocket plugin, or to submit a new version into WP Rocket through a PR.

1. Create a branch and PR for your changes in this repository.
2. Check out wp rocket plugin on branch develop (or a dedicated branch for the issue to test if needed)
3. Edit `package.json` inside WP Rocket plugin repository to change the targeted version of wp-rocket-scripts:
```
"wp-rocket-scripts": "github:wp-media/rocket-scripts#branch-name",
```

This syntax allows to target a specific branch as dependency. For instance:

```
"wp-rocket-scripts": "github:wp-media/rocket-scripts#enhancement/6741-adjust-beacon-timeout",
```

4. Remove `node_modules` directory and `package-lock.json` file.
5. Run the command
```
npm install
```

You should see the targeted version of the beacon in your working directory `/node_modules/wp-rocket-scripts/dist`.

6. Use the gulp task there to generate the beacon script:
```
npm run gulp build:js:beacon
```

You should see the new beacon files in `assets/js`.

7. Compile the plugin zip as usual.

## How to release a new version

When a new WP Rocket release occurs with a new version of rocket-scripts, or when new developments are available on rocket-scripts develop without breaking compatibility with WP Rocket, a new rocket-scripts version must be created. To do so:

1. Update the version in `package.json`.
2. Make sure everything is merged into `trunk` branch.
3. Create a release from `trunk`.
4. Github Workflow will run to release into npm.
5. In WP Rocket or any other code that uses this package can update the version in their `package.json` and run `npm install` again.
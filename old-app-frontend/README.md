# From: RDash rdash-angular
## Responsive, bloat free, bootstrap powered admin style dashboard!

rdash-angular is an AngularJS implementation of the RDash admin dashboard. The dashboard uses a small number of modules to get you started, along with some handy directives and controllers to speed up development using the dashboard.

## Usage
### Requirements
* [NodeJS](http://nodejs.org/) (with [NPM](https://www.npmjs.org/))
* [Bower](http://bower.io)
* [Gulp](http://gulpjs.com)

### Installation
1. Install the NodeJS dependencies: `npm install`.
2. Install the Bower dependencies: `bower install`.
3. Run the gulp build task: `gulp build`.
4. Run the gulp default task: `gulp`. This will build any changes made automatically, and also run a live reload server on [http://localhost:8888](http://localhost:8888).

### Development
Continue developing the dashboard further by editing the `src` directory. With the `gulp` command, any file changes made will automatically be compiled into the specific location within the `dist` directory.

#### Modules & Packages
By default, rdash-angular includes [`ui.bootstrap`](http://angular-ui.github.io/bootstrap/), [`ui.router`](https://github.com/angular-ui/ui-router) and [`ngCookies`](https://docs.angularjs.org/api/ngCookies). 

If you'd like to include any additional modules/packages not included with rdash-angular, add them to your `bower.json` file and then update the `src/index.html` file, to include them in the minified distribution output.
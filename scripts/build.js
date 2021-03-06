/* eslint-disable no-console */
const fs = require('fs-extra');
const {rollup} = require('rollup');
const babel = require('rollup-plugin-babel');
const {terser} = require('rollup-plugin-terser');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const includePaths = require('rollup-plugin-includepaths');
const path = require('path');
const less = require('less');
const purify = require('purify-css');
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');

// directories
const root_directory = path.join(__dirname, '..');
const node_modules_directory = path.join(root_directory, 'node_modules');
const frontend_directory = path.join(root_directory, 'frontend');
const backend_directory = path.join(root_directory, 'backend');
const view_directory = path.join(backend_directory, 'pages');
const js_directory = path.join(frontend_directory, 'js');
const less_directory = path.join(frontend_directory, 'less');
const image_directory = path.join(frontend_directory, 'images');
const locale_directory = path.join(frontend_directory, 'locales');
const dist_directory = path.join(root_directory, 'dist');
const dist_css_directory = path.join(dist_directory, 'css');
const dist_images_directory = path.join(dist_directory, 'images');
const dist_js_directory = path.join(dist_directory, 'js');
const dist_locales_directory = path.join(dist_directory, 'locales');

// pattern
const templates_pattern = path.join(view_directory, '/**/*.ejs');
const images_pattern = path.join(image_directory, '/**/*.{jpg,png}');

const buildCss = async (opts) => {
    await fs.ensureDir(dist_css_directory);
    const code = fs.readFileSync(path.join(less_directory, `${opts.name}.less`), 'utf8');
    const output = await less.render(code, {
        paths: [less_directory]
    });
    const css_file_path = path.join(dist_css_directory, `${opts.name}.css`);
    const cssmin_file_path = path.join(dist_css_directory, `${opts.name}.min.css`);

    fs.writeFileSync(css_file_path, output.css);

    if (process.env.NODE_ENV !== 'production') {
        return output.css;
    }

    const content = [opts.bundleOptions.dest, templates_pattern];
    if (opts.extJs) {
        content.push(...opts.extJs);
    }
    return await new Promise((resolve, reject) => {
        try {
            purify(
                content,
                [css_file_path],
                {
                    minify: true,
                    info: false,
                    rejected: false
                },
                (purified_css) => {
                    if (!purified_css) {
                        reject('purify exited with an empty css');
                    }
                    fs.writeFileSync(cssmin_file_path, purified_css);
                    resolve(purified_css);
                }
            );
        } catch (error) {
            reject(error);
        }
    });
};

const buildJs = async (opts) => {
    await fs.ensureDir(dist_js_directory);
    const bundle = await rollup(opts.options);
    bundle.write(opts.bundleOptions);
};

const buildImg = async () => {
    await fs.ensureDir(dist_images_directory);
    await imagemin([images_pattern], dist_images_directory, {
        plugins: [
            imageminMozjpeg(),
            imageminPngquant({quality: '65-80'})
        ]
    });
};

const copyLocales= () => {
    fs.copySync(
        locale_directory,
        dist_locales_directory
    );
};

const copyRobots= () => {
    fs.copySync(
        path.join(frontend_directory, 'robots.txt'),
        path.join(dist_directory, 'robots.txt')
    );
};

const copySitemap= () => {
    fs.copySync(
        path.join(frontend_directory, 'sitemap.xml'),
        path.join(dist_directory, 'sitemap.xml')
    );
};

const clean = (directory) => {
    fs.emptydirSync(directory || dist_directory);
};

const plugins = () => {
    const list = [
        nodeResolve({
            jsnext: true,
            main: true
        }),
        commonjs(),
        babel({
            babelrc: false,
            presets: ['es2015-rollup']
        }),
        includePaths({
            external: [
                'accounting',
                'bootbox',
                'handlebars',
                'historyjs',
                'i18next',
                'jquery',
                'minivents',
                'moment',
                'sugar',
                'frontexpress'
            ]
        })
    ];

    if (process.env.NODE_ENV === 'production') {
        list.push(terser());
    }

    return list;
};

const bundleOptions = (name) => {
    const suffix = process.env.NODE_ENV === 'production' ? '.min' : '';
    const opts = {
        dest: path.join(dist_js_directory, `${name}${suffix}.js`),
        format: 'umd',
        globals: {
            'accounting': 'accounting',
            'bootbox': 'bootbox',
            'handlebars': 'Handlebars',
            'historyjs': 'History',
            'i18next': 'i18next',
            'jquery': '$',
            'minivents': 'Events',
            'moment': 'moment',
            'sugar': 'Sugar',
            'frontexpress': 'frontexpress'
        },
        sourceMap: true
    };
    return opts;
};

const print = {
    name: 'print',
    options: {
        entry: path.join(js_directory, 'print.js'),
        plugins: plugins()
    },
    bundleOptions: bundleOptions('print')
};

const index = {
    name: 'index',
    options: {
        entry: path.join(js_directory, 'index.js'),
        plugins: plugins()
    },
    bundleOptions: bundleOptions('index'),
    extJs: [
        path.join(node_modules_directory, 'bootstrap-datepicker/dist/js/bootstrap-datepicker.min.js'),
        path.join(node_modules_directory, 'bootbox/bootbox.min.js')
    ]
};

const build = async (buildWhat) => {
    try {
        if (buildWhat) {
            switch (buildWhat) {
            case 'js':
                clean(dist_js_directory);
                await buildJs(print);
                await buildJs(index);
                console.log('js files rebuilt');
                break;
            case 'css':
                clean(dist_css_directory);
                await buildCss(print);
                await buildCss(index);
                console.log('less files rebuilt');
                break;
            case 'img':
                clean(dist_images_directory);
                await buildImg();
                console.log('image files rebuilt');
                break;
            case 'static':
                clean(dist_locales_directory);
                copyLocales();
                copyRobots();
                copySitemap();
                console.log('static files rebuilt');
                break;
            default:
                console.error('target not found');
                break;
            }
        } else {
            // Full build
            clean();
            await buildJs(print);
            await buildCss(print);
            await buildJs(index);
            await buildCss(index);
            await buildImg();
            copyLocales();
            copyRobots();
            copySitemap();
        }
    } catch(error) {
        console.error(error);
    }
};

(async () => {
    let buildWhat;
    if (process.argv.length > 2) {
        // Partial build
        buildWhat = process.argv[2].toLowerCase();
    }

    await build(buildWhat);
})();



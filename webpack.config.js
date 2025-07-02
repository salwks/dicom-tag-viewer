// webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  // 기본 설정
  const baseConfig = {
    context: path.resolve(__dirname),
    devtool: isProduction ? "source-map" : "eval-source-map",

    resolve: {
      extensions: [".js", ".json"],
      alias: {
        "@": path.resolve(__dirname, "static/js"),
      },
    },

    module: {
      rules: [
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: "asset/resource",
        },
      ],
    },

    plugins: [new CleanWebpackPlugin()],

    optimization: {
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
        },
      },
    },
  };

  // 모던 브라우저용 설정 (ES6 모듈)
  const modernConfig = {
    ...baseConfig,
    name: "modern",
    entry: {
      app: "./static/js/app.js",
    },
    output: {
      path: path.resolve(__dirname, "dist/modern"),
      filename: isProduction ? "[name].[contenthash].js" : "[name].js",
      chunkFilename: isProduction
        ? "[name].[contenthash].chunk.js"
        : "[name].chunk.js",
      clean: true,
      module: true,
      environment: {
        arrowFunction: true,
        const: true,
        destructuring: true,
        dynamicImport: true,
        forOf: true,
        module: true,
      },
    },
    target: ["web", "es2017"],
    experiments: {
      outputModule: true,
    },
    module: {
      ...baseConfig.module,
      rules: [
        ...baseConfig.module.rules,
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  "@babel/preset-env",
                  {
                    targets: {
                      esmodules: true,
                    },
                    modules: false,
                    useBuiltIns: "usage",
                    corejs: 3,
                  },
                ],
              ],
              plugins: ["@babel/plugin-syntax-dynamic-import"],
            },
          },
        },
      ],
    },
    plugins: [
      ...baseConfig.plugins,
      new HtmlWebpackPlugin({
        template: "./static/index.html",
        filename: "index.html",
        scriptLoading: "module",
        inject: "head",
        templateParameters: {
          isModern: true,
        },
      }),
    ],
  };

  // 레거시 브라우저용 설정 (ES5)
  const legacyConfig = {
    ...baseConfig,
    name: "legacy",
    entry: {
      app: "./static/js/app.js",
    },
    output: {
      path: path.resolve(__dirname, "dist/legacy"),
      filename: isProduction ? "[name].[contenthash].js" : "[name].js",
      chunkFilename: isProduction
        ? "[name].[contenthash].chunk.js"
        : "[name].chunk.js",
      clean: true,
      environment: {
        arrowFunction: false,
        const: false,
        destructuring: false,
        dynamicImport: false,
        forOf: false,
        module: false,
      },
    },
    target: ["web", "es5"],
    module: {
      ...baseConfig.module,
      rules: [
        ...baseConfig.module.rules,
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  "@babel/preset-env",
                  {
                    targets: {
                      browsers: ["> 1%", "last 2 versions", "IE 11"],
                    },
                    modules: false,
                    useBuiltIns: "usage",
                    corejs: 3,
                  },
                ],
              ],
              plugins: [
                "@babel/plugin-transform-runtime",
                "@babel/plugin-proposal-dynamic-import",
              ],
            },
          },
        },
      ],
    },
    plugins: [
      ...baseConfig.plugins,
      new HtmlWebpackPlugin({
        template: "./static/index.html",
        filename: "index.html",
        scriptLoading: "blocking",
        inject: "head",
        templateParameters: {
          isModern: false,
        },
      }),
    ],
  };

  // 개발 서버 설정
  const devServerConfig = {
    static: {
      directory: path.join(__dirname, "static"),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
    proxy: {
      "/upload": "http://localhost:8080",
      "/preview": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  };

  // 환경별 설정 반환
  if (argv.mode === "development") {
    return {
      ...modernConfig,
      devServer: devServerConfig,
    };
  }

  // 프로덕션에서는 두 버전 모두 빌드
  return [modernConfig, legacyConfig];
};

// package.json scripts 추가 예시:
/*
{
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production",
    "build:modern": "webpack --mode production --env modern",
    "build:legacy": "webpack --mode production --env legacy",
    "analyze": "webpack-bundle-analyzer dist/modern/app.*.js"
  },
  "devDependencies": {
    "@babel/core": "^7.22.0",
    "@babel/plugin-proposal-dynamic-import": "^7.18.6",
    "@babel/plugin-syntax-dynamic-import": "^7.8.3",
    "@babel/plugin-transform-runtime": "^7.22.0",
    "@babel/preset-env": "^7.22.0",
    "babel-loader": "^9.1.0",
    "clean-webpack-plugin": "^4.0.0",
    "css-loader": "^6.8.0",
    "html-webpack-plugin": "^5.5.0",
    "style-loader": "^3.3.0",
    "webpack": "^5.88.0",
    "webpack-bundle-analyzer": "^4.9.0",
    "webpack-cli": "^5.1.0",
    "webpack-dev-server": "^4.15.0"
  },
  "dependencies": {
    "@babel/runtime": "^7.22.0",
    "core-js": "^3.31.0"
  }
}
*/

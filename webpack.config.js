const path = require("path");

const appDirectory = path.resolve(__dirname);
const BASE_FRAMEWORK_PATH = "./node_modules/@frontmltd/frontmjs";
const FRAMEWORK_DIR = path.resolve(appDirectory, BASE_FRAMEWORK_PATH);

const babelLoaderConfiguration = {
  test: /\.js$/,
  // Add every directory that needs to be compiled by Babel during the build.
  include: [FRAMEWORK_DIR, path.resolve(appDirectory, "src")],
  use: {
    loader: "babel-loader",
    options: {
      presets: [
        [
          "@babel/preset-env",
          {
            targets: { node: "20" },
            modules: false,
            bugfixes: true,
          },
        ],
      ],
    },
  },
};

const config = {
  entry: [BASE_FRAMEWORK_PATH],
  output: {
    path: path.resolve(__dirname, "dist"),
    library: {
      name: "botModule",
      type: "assign",
    },
  },
  module: {
    rules: [babelLoaderConfiguration],
  },
  resolve: {
    modules: [
      path.resolve(__dirname + "/src"),
      path.resolve(__dirname + "/node_modules"),
    ],
  },
  cache: {
    type: "filesystem",
    buildDependencies: {
      config: [__filename],
    },
  },
};

module.exports = () => {
  config.mode = "production";
  config.target = "node20";
  return config;
};

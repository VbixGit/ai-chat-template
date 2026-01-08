const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const dotenv = require("dotenv");
const CopyWebpackPlugin = require("copy-webpack-plugin");

// Load environment variables from .env file
const env = dotenv.config().parsed || {};

// Create an object to define environment variables for the client
// Use ENV_* pattern to avoid "process is not defined" errors in browsers
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`ENV_${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = {
  entry: "./src/index.js",

  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "docs"),
  },

  devServer: {
    static: "./docs",
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
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

  plugins: [
    new HtmlWebpackPlugin({
      template: "public/index.html",
      inject: true,
    }),
    new HtmlWebpackPlugin({
      template: "public/index.html",
      filename: "404.html",
      inject: true,
    }),
    new webpack.DefinePlugin(envKeys),
  ],

  resolve: {
    extensions: [".js", ".jsx", ".json"],
  },
};

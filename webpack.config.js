const isProduction = process.env.NODE_ENV === "production"

module.exports = {
  mode: isProduction ? "production" : "development",
  entry: {
    app: __dirname + "/src/_assets/scripts/app.js",
  },
  output: {
    path: isProduction ? __dirname + "/dist/static" : __dirname + "/src/static",
    filename: "app.bundled.js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader",
      },
    ],
  },
}

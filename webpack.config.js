module.exports = {
  entry: {
    index: "./src/index.js",
    worker: "./src/worker.js"
  },
  output: {
    path: __dirname + "/web/",
    filename: "[name].js",
    chunkFilename: "[name].js"
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      }
    ]
  }
}

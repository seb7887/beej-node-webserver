const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const port = 9000;

// Use the current directory as base directory for all file serving
const basedir = process.cwd();

let server;

function getMIMEType(filename) {
  const mimeTypes = {
    ".js": "application/javascript",
    ".jpg": "image/jpg",
    ".jpeg": "image/jpg",
    ".png": "image/png",
    ".html": "text/html"
  };

  // Get the extension
  const ext = path.extname(filename);

  if (ext in mimeTypes) {
    return mimeTypes[ext];
  }

  // If we don't recognize it, just return this default
  return "text/plain";
}

function getFilenameFromPath(filepath, callback) {
  // Get all those %20s, +s, and stuff out of there
  filepath = decodeURI(filepath.replace(/\+/g, "%20"));

  // Normalize will translate out all the ./ and ../ parts out of the path and turn it
  // into a plain, absolute path
  let filename = path.normalize(basedir + path.sep + filepath);
  let st;

  /**
   * Called when the fs.stat() call completes
   */
  function onStatComplete(err, stats) {
    if (err) {
      return callback(err, filename);
    }

    if (stats.isDirectory()) {
      filename = path.normalize(filename + path.sep + "index.html");
      fs.stat(filename, onStatComplete);
      return;
    }

    if (stats.isFile()) {
      return callback(null, filename);
    } else {
      return callback(new Error("Unknown File Type"), filename);
    }
  }

  if (filename.substring(0, basedir.length) !== basedir) {
    // If not, 404 it
    let err = new Error("Not Found");
    err.code = "ENOENT";
    return callback(err, filename);
  }

  // Now see if we can find the file:
  fs.stat(filename, onStatComplete);
}

const httpHandler = (req, res) => {
  // *** Magic happens here ***
  function onGotFileName(err, filename) {
    /**
     * Helper function to return errors in the response
     */
    function writeError(err) {
      if (err.code === "ENOENT") {
        // File not found
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.write("500 Internal Server Error\n");
        res.end();
        console.log(`Internal Server Error: ${filename}: ${err.code}`);
      }
    }

    if (err) {
      writeError(err);
    } else {
      // No errors, so go ahead
      fs.readFile(filename, "binary", (err, file) => {
        if (err) {
          writeError(err);
        } else {
          // No errors, so write the response
          let mimeType = getMIMEType(filename);
          res.writeHead(200, { "Content-Type": mimeType });
          res.write(file, "binary");
          res.end();
          console.log(`Sending file: ${filename}`);
        }
      });
    }
  }

  // Extract the part of the URL after the host:port. This is the filename the browser is looking for
  let path = url.parse(req.url).pathname;

  // Try to find the actual file associated with this path
  getFilenameFromPath(path, onGotFileName);
};

const startHTTPServer = () => {
  server = http.createServer(httpHandler).listen(port);
  console.log(`Listening on port ${port}`);
  return server;
};

exports.start = startHTTPServer;

if (require.main == module) {
  startHTTPServer();
}

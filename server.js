const express = require('express')
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mkdirp = require('mkdirp')
const fs = require('fs');
const spawn = require('child_process').spawn;


const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

const dbFile = './sayings.db';

const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.log(`Error opening db: ${err.code} ${err.message}`);
    exit(1);
  }
});

db.exec(`
  create table if not exists sayings (
      text text not null,
      file text not null
  );`)

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniqueText ON sayings (text)`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniqueText ON sayings (file)`);

function respond(text, res) {
  db.all("select file from sayings where text = ?", text, (err, rows) => {
    let filename = null;
    if (rows && rows.length > 0) {
      filename = rows[0].file;
    } else {
      filename = crypto.createHash('sha256').update(text).digest('hex') + ".wav";
    }
    const insert = db.prepare("INSERT OR IGNORE INTO sayings (text, file) VALUES (?, ?)");
    insert.run(text, filename);
    insert.finalize();

    const depth = 10;
    const subdirs = filename.split("", depth).join("/");
    const directory = "./files/" + subdirs;
    mkdirp(directory);

    const relativepath = directory + "/" + filename;
    fs.realpath(relativepath, (err, resolvedPath) => {
      let path = resolvedPath;
      if (err) {
        if (err.code == "ENOENT") {
          path = err.path;
          const auPath = path.replace(".wav", ".au");

          console.log(`tropesay.sh ${auPath}`)

          const tropesay = spawn('./tropetalk/tropesay.sh', [auPath]);
          tropesay.on('close', (code) => {
            console.log(`sox ${auPath} ${path}`)
            const sox = spawn('sox', [auPath, path]);

            sox.on('close', (soxCode) => {
              res.sendFile(path);
            });
            sox.stdin.end();
          });
          tropesay.stdin.write(text, (err) => {
            tropesay.stdin.end();
          })
          return;
        } else {
          res.status(404);
          res.send("file not found");
          return;
        }
      }

      res.sendFile(path);

    });
  });
}


app.post('/tropesay', (req, res) => {
  const text = req.body.text;
  respond(text, res);
})

app.get('/tropesay', (req, res) => {
  const text = req.query.text;
  console.log(req.query);
  if (text) {
    respond(text, res);
  } else {
    res.status(400);
    res.send("query param 'text' is required");
  }
})


const port = 3001;

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})



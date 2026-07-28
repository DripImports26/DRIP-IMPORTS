// lib/db.js
// Camada simples de persistência em arquivos JSON, sem dependências externas.
// Cada arquivo tem uma fila de escrita própria para evitar corrupção quando
// duas requisições tentam gravar ao mesmo tempo.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

const queues = new Map();

function queue(file, task) {
  const prev = queues.get(file) || Promise.resolve();
  const next = prev.then(task, task);
  queues.set(file, next.catch(() => {}));
  return next;
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readSync(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  const raw = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.error(`[db] Falha ao ler ${name}.json, usando valor padrão.`, e);
    return fallback;
  }
}

function read(name, fallback = []) {
  return queue(name, () =>
    fs.promises
      .readFile(filePath(name), "utf8")
      .catch(() => JSON.stringify(fallback))
      .then((raw) => {
        try {
          return JSON.parse(raw || "[]");
        } catch {
          return fallback;
        }
      })
  );
}

function write(name, data) {
  return queue(name, async () => {
    const p = filePath(name);
    const tmp = `${p}.tmp`;
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.promises.rename(tmp, p);
    return data;
  });
}

async function all(name) {
  return read(name, []);
}

async function insert(name, record) {
  return queue(name, async () => {
    const p = filePath(name);
    let list = [];
    try {
      list = JSON.parse(await fs.promises.readFile(p, "utf8"));
    } catch {
      list = [];
    }
    list.push(record);
    const tmp = `${p}.tmp`;
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(list, null, 2));
    await fs.promises.rename(tmp, p);
    return record;
  });
}

async function update(name, predicate, updater) {
  return queue(name, async () => {
    const p = filePath(name);
    let list = [];
    try {
      list = JSON.parse(await fs.promises.readFile(p, "utf8"));
    } catch {
      list = [];
    }
    let updated = null;
    list = list.map((item) => {
      if (predicate(item)) {
        updated = updater({ ...item });
        return updated;
      }
      return item;
    });
    const tmp = `${p}.tmp`;
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(list, null, 2));
    await fs.promises.rename(tmp, p);
    return updated;
  });
}

async function remove(name, predicate) {
  return queue(name, async () => {
    const p = filePath(name);
    let list = [];
    try {
      list = JSON.parse(await fs.promises.readFile(p, "utf8"));
    } catch {
      list = [];
    }
    const before = list.length;
    list = list.filter((item) => !predicate(item));
    const tmp = `${p}.tmp`;
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(list, null, 2));
    await fs.promises.rename(tmp, p);
    return before !== list.length;
  });
}

// Garante que os arquivos de dados existam ao iniciar o servidor.
function ensureFiles() {
  readSync("products", []);
  readSync("users", []);
  readSync("orders", []);
}

module.exports = { all, insert, update, remove, write, read, ensureFiles };

'use strict';

// Talks to an ebusd daemon over its TCP command port (default 8888).
// Uses only the "hex" command, so ebusd must run with --enablehex; all message
// knowledge lives in this app. ebusd does arbitration with its own address.

const net = require('net');
const { EventEmitter } = require('events');
const { hex, fromHex } = require('./ebus');

class EbusdTransport extends EventEmitter {
  constructor({ host, port = 8888, timeout = 10000, log = () => {} }) {
    super();
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.log = log;
    this.sock = null;
    this.buf = '';
    this.pending = null;
    this.queue = Promise.resolve();
  }

  get connected() { return !!this.sock && !this.sock.destroyed; }

  async connect() {
    if (this.connected) return;
    await new Promise((resolve, reject) => {
      const s = net.createConnection({ host: this.host, port: this.port });
      const fail = (err) => { s.destroy(); reject(err); };
      s.setTimeout(this.timeout, () => fail(new Error('connect timeout')));
      s.once('error', fail);
      s.once('connect', () => {
        s.setTimeout(0);
        s.removeListener('error', fail);
        s.setKeepAlive(true, 30000);
        s.on('data', (d) => this._onData(d));
        s.on('error', (err) => this.log('ebusd socket error', err.message));
        s.on('close', () => {
          this.sock = null;
          if (this.pending) { this.pending.reject(new Error('connection closed')); this.pending = null; }
          this.emit('disconnected');
        });
        this.sock = s;
        this.emit('connected');
        resolve();
      });
    });
  }

  close() {
    if (this.sock) this.sock.destroy();
    this.sock = null;
  }

  _onData(d) {
    this.buf += d.toString('utf8');
    // every answer ends with an empty line
    let i;
    while ((i = this.buf.indexOf('\n\n')) >= 0) {
      const answer = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 2);
      if (this.pending) { const p = this.pending; this.pending = null; p.resolve(answer); }
    }
  }

  /** Send one ebusd command line, get its answer text. Serialized. */
  command(line) {
    const run = async () => {
      await this.connect();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = null;
          reject(new Error(`ebusd timeout: ${line}`));
        }, this.timeout);
        this.pending = {
          resolve: (a) => { clearTimeout(timer); resolve(a); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        };
        this.sock.write(`${line}\n`);
      });
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /**
   * Master-slave exchange. Returns the slave's data bytes (without NN),
   * or [] for a broadcast / master-master telegram.
   */
  async request(zz, pbsb, data) {
    const d = Array.from(data || []);
    const tele = [zz, pbsb >> 8, pbsb & 0xFF, d.length, ...d];
    const a = await this.command(`hex ${hex(tele)}`);
    if (/^ERR/i.test(a)) throw new Error(`ebusd: ${a}`);
    const bytes = fromHex(a.split('\n')[0]);
    if (!bytes.length) return [];
    const nn = bytes[0];
    if (bytes.length < nn + 1) throw new Error(`short answer ${a}`);
    return bytes.slice(1, 1 + nn);
  }

  async info() {
    return this.command('info');
  }
}

module.exports = EbusdTransport;

const { parse, isValid } = require('date-fns');

let d = new Date("2026/2/21 0:55");
console.log("Native JS Chrome style parsed (might fail in Safari):", d.getTime());

d = parse("2026/2/21 0:55", "yyyy-MM-dd HH:mm:ss", new Date());
console.log("date-fns fallback with wrong format:", d.getTime());

d = parse("2026/2/21 0:55", "yyyy/M/d H:mm", new Date());
console.log("date-fns correct fallback:", d.getTime());

import { db, rawDb } from './dist/main/database/init.js';

console.log('db instance:', typeof db);
console.log('rawDb instance:', typeof rawDb);

// Try to insert and query
rawDb.prepare('CREATE TABLE test (id INTEGER)').run();
rawDb.prepare('INSERT INTO test VALUES (1)').run();

const result = await db.selectFrom('test').selectAll().execute();
console.log('Query result:', result);

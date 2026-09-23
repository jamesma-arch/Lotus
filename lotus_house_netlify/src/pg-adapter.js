// Compatibility layer for the original D1 query pattern, using PostgreSQL.
// Each batch runs within one transaction so PIN creation and scoring stay consistent.
export function postgresDatabase(pool) {
  const makeStatement=(sql, runQuery, args=[])=>({
    bind(...params){return makeStatement(sql,runQuery,params);},
    async first(){const r=await runQuery(sql,args);return r.rows[0]??null;},
    async all(){const r=await runQuery(sql,args);return {results:r.rows};},
    async run(){const r=await runQuery(sql,args);return {meta:{changes:r.rowCount??0}};},
    _sql:sql,_args:args
  });
  function translate(sql){
    let n=0;
    return sql.replace(/\?/g,()=>`$${++n}`).replace(/datetime\('now'\)/gi,'NOW()');
  }
  const query=(sql,args=[])=>pool.query(translate(sql),args);
  return {
    prepare(sql){return makeStatement(sql,query);},
    async batch(statements){
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const results=[];
        for(const stmt of statements){
          const r=await client.query(translate(stmt._sql),stmt._args);
          results.push({results:r.rows,meta:{changes:r.rowCount??0}});
        }
        await client.query('COMMIT');
        return results;
      }catch(err){await client.query('ROLLBACK');throw err;}
      finally{client.release();}
    }
  };
}

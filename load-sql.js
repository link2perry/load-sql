"use strict";

var fs = require('fs');

let _flatten = (param) => {
  if(param) {
    return param.split('.').map((str, i) => {
      if(i === 0) {
        return str;
      } else {
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
    }).join('');
  }
  return '';
}

class LoadSql {

  constructor(sqlDir) {
    this.sqlDir = sqlDir;
    this.sqlCache = {};
  }

  load(file, q = {}, callback) {
    if(typeof callback === 'undefined') {
      return new Promise(succeed => {
        this.loadAndCallback(file, q, (sql, params) => {
          succeed({sql, params});
        })
      });
    } else {
      this.loadAndCallback(file, q, callback);
    }
  }

  loadAndCallback (file, q = {}, callback) {
    var params = null;
    var orderBy = [];
    var where = [];
    var page = null;
    var size = null;
    var sorting = null;
    if(typeof q !== 'undefined') {
      if(typeof q.sorting !== 'undefined') {
        orderBy = q.sorting.split('@@@').map(s => _flatten(s));
      }
      if(typeof q.filtering !== 'undefined') {
        where = q.filtering.split('@@@');
        where = where.map(i => {
          let splitForOr = i.split('|||');
          return splitForOr.map(j => {
            let splitForColon =  j.split(':');
            let key = _flatten(splitForColon[0]);
            let value = decodeURIComponent(splitForColon[1]).toLowerCase();
            return 'lower(' + key + ') like \'%' + value.replace(/'/g,"\\'") + '%\'';
          }).join(' or ');
        });
      }    

      if(typeof q.matching !== 'undefined') {
        var m = q.matching.split('@@@');
        m = m.map((i) => {
          let splitForOr = i.split('|||');
          return splitForOr.map(j => {
            let splitForColon =  j.split(':');
            let key = _flatten(splitForColon[0]);
            let value = decodeURIComponent(splitForColon[1]).toLowerCase();
            return key + '=\'' + value.replace(/'/g,"\\'") + '\'';
          }).join(' or ');
        });
        where.push(...m);
      }

      if(typeof q.matching !== 'undefined' || typeof q.filtering !== 'undefined') {
        where = where.map(wrapThis => {
          return ' ( ' + wrapThis + ' ) ';
        });
        where = [where.join(' and ')]; 
      }

      var page = q.page;
      var size = q.size;
      if(typeof page !== 'undefined' && typeof size !== 'undefined') {
        size = parseInt(size, 10);
        page = parseInt(page, 10);
        params = [(page * size), size];
      }
    }

    if(this.sqlCache[file]) {
      var sql = this.sqlCache[file];
      if(where.length > 0) {
        sql = 'select * from (' + sql  + ') temp where ' + where.join(' and ');
      }

      if(orderBy.length > 0) {
        sql = 'select * from (' + sql  + ') temp order by ' + orderBy.join(',') + ' ';
      }
      if(params) {
        sql += ' limit ?, ?';
        callback(sql, params);
      } else {
        callback(sql);
      }
    } else {
      var me = this;
      fs.readFile(this.sqlDir + file + '.sql', 'utf8', function(err, sql){
        if (err){
          console.log(err);
        } else {
          me.sqlCache[file] = sql;
          if(where.length > 0) {
            sql = 'select * from (' + sql  + ') temp where ' + where.join(' and ');
          }
          if(orderBy.length > 0) {
            sql = 'select * from (' + sql  + ') temp order by ' + orderBy.join(',') + ' ';
          }
          if(params) {
            sql += ' limit ?, ?';
            // console.log("Sql: ",sql)
            callback(sql, params);
          } else {
            // console.log("Sql: ",sql)
            callback(sql);
          }
        }
      });
    }
  }
}

module.exports = LoadSql;
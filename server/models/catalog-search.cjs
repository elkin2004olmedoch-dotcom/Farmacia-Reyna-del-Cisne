const {Prisma}=require('./prisma-client.cjs');
const postgresql=/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '');
const normalize=value=>String(value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
const accents='áéíóúüñÁÉÍÓÚÜÑ';
function folded(expression){
  // Both providers use the same Spanish folding, without requiring extensions.
  if(postgresql)return Prisma.sql`lower(translate(${expression},${accents+'\u0301\u0308\u0303'},${[...accents].map(normalize).join('')}))`;
  for(const character of accents+'\u0301\u0308\u0303')expression=Prisma.sql`replace(${expression},${character},${normalize(character)})`;
  return Prisma.sql`lower(${expression})`;
}
const metadata={laboratorio:Prisma.sql`coalesce("laboratorio",'')`,presentacion:Prisma.sql`coalesce("presentacion",'')`};
const searchable=folded(Prisma.sql`"nombre" || ' ' || "descripcion" || ' ' || coalesce("laboratorio",'') || ' ' || coalesce("principioActivo",'') || ' ' || coalesce("presentacion",'') || ' ' || coalesce("codigoInterno",'') || ' ' || coalesce("codigoBarras",'')`);
function where({q,categoria,laboratorio,presentacion}={}){
  const terms=[Prisma.sql`"activo" = ${true}`];
  if(categoria)terms.push(Prisma.sql`"categoria" = ${categoria}`);
  for(const [field,value] of Object.entries({laboratorio,presentacion}))if(value)terms.push(Prisma.sql`${folded(metadata[field])} = ${normalize(value)}`);
  for(const word of normalize(q).split(/\s+/).filter(Boolean)){
    const literal=word.replace(/[\\%_]/g,'\\$&');
    terms.push(Prisma.sql`${searchable} LIKE ${'%'+literal+'%'} ESCAPE ${'\\'}`);
  }
  return Prisma.join(terms,' AND ');
}
function nearWord(query,word){
  if(word.length<5 || query[0]!==word[0] || Math.abs(query.length-word.length)>1)return false;
  let i=0;while(i<query.length && query[i]===word[i])i++;
  if(i===query.length)return word.length===query.length+1;
  if(query.length===word.length)return query.slice(i+1)===word.slice(i+1) || query[i]===word[i+1] && query[i+1]===word[i] && query.slice(i+2)===word.slice(i+2);
  return query.length>word.length?query.slice(i+1)===word.slice(i):query.slice(i)===word.slice(i+1);
}
function candidatePrefix(query){
  const words=folded(Prisma.sql`"nombre" || ' ' || coalesce("principioActivo",'')`);
  const prefix=query.slice(0,2);
  return Prisma.sql`(${words} LIKE ${prefix+'%'} OR ${words} LIKE ${'% '+prefix+'%'})`;
}
module.exports={where,normalize,nearWord,candidatePrefix};

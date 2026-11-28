/* Shared RU/EN name resolver and character alias lookup for the whole catalog. */
(function(){
 'use strict';
 const DATA=window.DBD_NAME_DATA||{};
 const NAMES=DATA.names||{}, CHARACTERS=Array.isArray(DATA.characters)?DATA.characters:[], ALIASES=DATA.characterByAlias||{};
 const KIND_ALIASES={
  characters:'character', character:'character',
  perks:'perk', perk:'perk',
  items:'item', item:'item',
  addons:'addon', addon:'addon',
  offerings:'offering', offering:'offering',
  maps:'map', map:'map'
 };
 const SINGULAR={character:'character',perk:'perk',item:'item',addon:'addon',offering:'offering',map:'map'};
 const CYR=/[А-Яа-яЁё]/, LAT=/[A-Za-z]/;
 function splitDisplayName(value){
  const text=String(value??'').trim();
  if(!text.endsWith(')'))return null;
  let depth=0,start=-1;
  for(let i=text.length-1;i>=0;i--){
   if(text[i]===')')depth++;
   else if(text[i]==='('){
    depth--;
    if(depth===0){start=i;break}
   }
  }
  if(start<0)return null;
  return {ru:text.slice(0,start).trim(),en:text.slice(start+1,text.length-1).trim(),index:start,text};
 }
 const strip=value=>{
  const parts=splitDisplayName(value);
  return parts&&CYR.test(parts.ru)&&LAT.test(parts.en)?parts.ru:String(value??'').trim();
 };
 const norm=value=>strip(value).toLocaleLowerCase('ru').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9а-яё]+/gi,'');
 const slug=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ru').replace(/[^a-z0-9а-яё]+/gi,'-').replace(/^-|-$/g,'');
 const kindOf=kind=>KIND_ALIASES[String(kind||'')]||(SINGULAR[String(kind||'')]?String(kind):'');
 const isFormatted=value=>{const parts=splitDisplayName(value);return !!(parts&&CYR.test(parts.ru)&&LAT.test(parts.en))};
 const format=(ru,en)=>{
  const russian=strip(ru),english=strip(en);
  if(russian&&english&&russian!==english&&CYR.test(russian)&&LAT.test(english))return `${russian} (${english})`;
  return russian||english||'';
 };
 const canonicalByKey=new Map(CHARACTERS.map(entry=>[norm(entry.en),entry]));
 const characterKeysByCanonical=new Map();
 const addCharacterKey=(key,canonicalKey)=>{
  if(!key||!canonicalKey)return;
  if(!characterKeysByCanonical.has(canonicalKey))characterKeysByCanonical.set(canonicalKey,new Set());
  characterKeysByCanonical.get(canonicalKey).add(key);
 };
 for(const [key,canonicalKey] of Object.entries(ALIASES))addCharacterKey(norm(key),norm(canonicalKey));
 for(const [key,info] of Object.entries(NAMES))if(info&&info.kind==='character')addCharacterKey(key,norm(info.en));
 for(const entry of CHARACTERS){
  const key=norm(entry.en);
  for(const value of [entry.en,entry.ru,entry.display,...(entry.aliases||[])])addCharacterKey(norm(value),key);
 }
 const generalKeys=new Set(['','all','general','allcharacters','allkillers','allsurvivors','общиеперки','общийперк','общий','общие','безвладельца','непривязан']);
 const isGeneral=value=>generalKeys.has(norm(value));

 function extractEnglish(value){
  const parts=splitDisplayName(value);
  return parts&&CYR.test(parts.ru)&&LAT.test(parts.en)?parts.en:'';
 }
 function fieldValues(record,expected){
  if(!record||typeof record!=='object')return [];
  const fields=expected==='character'?[
   record.id,record.slug,record.nameEn,record.englishName,record.name_en,record.english_name,
   record.nameRu,record.name_ru,record.russianName,record.russian_name,record.name,
   record.displayName,record.display_name,record.title,record.killerName,record.key
  ]:[
   record.id,record.slug,record.nameEn,record.englishName,record.name_en,record.english_name,
   record.nameRu,record.name_ru,record.russianName,record.russian_name,record.translation,
   record.name,record.displayName,record.display_name,record.title,record.killerName,
   record.characterName,record.character_name,record.character,record.owner,record.key
  ];
  return fields.filter(value=>value!==null&&value!==undefined&&value!=='');
 }
 function stringValues(value){
  const text=String(value??'');
  const inside=extractEnglish(text);
  return [text,strip(text),inside,text.replace(/^The\s+/i,''),strip(text).replace(/^The\s+/i,'')].filter(Boolean);
 }
 function nameInfo(value,expected){
  const kind=kindOf(expected),candidates=value&&typeof value==='object'?fieldValues(value,kind):stringValues(value);
  for(const candidate of candidates){
   const variants=[String(candidate),strip(candidate),String(candidate).replace(/^The\s+/i,'')];
   for(const variant of variants){
    const key=norm(variant);
    if(!key)continue;
    if(kind){
     const scoped=NAMES[norm(`${kind}:${variant}`)];
     if(scoped&&scoped.kind===kind)return scoped;
    }
    if(kind==='character'){
     const canonicalKey=ALIASES[key]||ALIASES[key.replace(/^the/,'')];
     const canonical=canonicalByKey.get(canonicalKey);
     if(canonical)return {ru:canonical.ru,en:canonical.en,display:canonical.display,kind:'character',role:canonical.role};
    }
    const direct=NAMES[key];
    if(direct&&(!kind||direct.kind===kind))return direct;
    const withoutThe=key.replace(/^the/,'');
    if(withoutThe!==key){
     const short=NAMES[withoutThe];
     if(short&&(!kind||short.kind===kind))return short;
    }
   }
  }
  return null;
 }
 function canonicalCharacter(value){
  const candidates=value&&typeof value==='object'?fieldValues(value,'character'):stringValues(value);
  for(const candidate of candidates){
   const variants=[String(candidate),strip(candidate),String(candidate).replace(/^The\s+/i,'')];
   for(const variant of variants){
    const key=norm(variant);
    if(!key)continue;
    const aliasKey=ALIASES[key]||ALIASES[key.replace(/^the/,'')];
    const byAlias=canonicalByKey.get(aliasKey);
    if(byAlias)return byAlias;
    const byName=canonicalByKey.get(key);
    if(byName)return byName;
    const info=NAMES[key];
    if(info&&info.kind==='character'){
     const canonical=canonicalByKey.get(norm(info.en));
     if(canonical)return canonical;
    }
   }
  }
  return null;
 }
 function russianFrom(record){
  for(const value of [
   record?.nameRu,record?.name_ru,record?.russianName,record?.russian_name,record?.translation,
   strip(record?.displayName),strip(record?.display_name),record?.name
  ]){
   const text=strip(value);
   if(text&&CYR.test(text))return text;
  }
  return '';
 }
 function englishFrom(record){
  for(const value of [
   record?.nameEn,record?.englishName,record?.name_en,record?.english_name,
   extractEnglish(record?.displayName),extractEnglish(record?.display_name)
  ]){
   const text=strip(value);
   if(text&&LAT.test(text))return text;
  }
  for(const value of [record?.name,record?.title,record?.displayName,record?.display_name,record?.id,record?.slug]){
   const text=strip(value);
   if(text&&LAT.test(text)&&!CYR.test(text))return text;
  }
  return '';
 }
 function displayName(value,kind,fallback){
  const expected=kindOf(kind);
  const text=value&&typeof value!=='object'?String(value??'').trim():'';
  // An already formatted "Русское имя (English Name)" is authoritative; a RU
  // alias must not be re-resolved to a different English record.
  if(isFormatted(text))return text;
  if(expected==='character'){
   const canonical=canonicalCharacter(value);
   if(canonical&&canonical.display)return canonical.display;
  }
  if(value&&typeof value==='object'){
   const ru=russianFrom(value),en=englishFrom(value);
   const own=format(ru,en);
   if(own)return own;
  }
  const info=nameInfo(value,expected);
  if(info&&(!expected||info.kind===expected)){
   const translated=format(info.ru,info.en)||info.display;
   if(translated)return translated;
  }
  if(value&&typeof value==='object'){
   for(const raw of [value.displayName,value.display_name,value.name,value.title,value.nameEn,value.id]){
    const rawText=String(raw??'').trim();
    if(isFormatted(rawText))return rawText;
   }
   return String(value.displayName||value.display_name||value.name||value.title||value.nameEn||value.id||fallback||'Без названия');
  }
  if(isFormatted(text))return text;
  if(!expected&&info){
   const translated=format(info.ru,info.en)||info.display;
   if(translated)return translated;
  }
  return text||String(fallback||'');
 }
 function recordEnglish(value,kind){
  if(value&&typeof value==='object'){
   const own=englishFrom(value);
   if(own)return own;
  }else{
   const inside=extractEnglish(value);
   if(inside)return inside;
  }
  const info=nameInfo(value,kindOf(kind));
  if(info?.en)return info.en;
  return strip(value&&typeof value==='object'?(value.nameEn||value.englishName||value.name||value.displayName||value.id||''):value);
 }
 function characterKey(value){
  const canonical=canonicalCharacter(value);
  return canonical?norm(canonical.en):norm(value);
 }
 function poolRecords(pool){
  if(Array.isArray(pool))return pool.filter(x=>x&&typeof x==='object');
  if(pool&&typeof pool==='object')return Object.values(pool).flatMap(x=>Array.isArray(x)?x:[x]).filter(x=>x&&typeof x==='object');
  return [];
 }
 function characterRecord(value,pool){
  if(isGeneral(value))return null;
  const canonical=canonicalCharacter(value);
  if(!canonical)return null;
  const key=norm(canonical.en),aliases=new Set(characterKeysByCanonical.get(key)||[key]);
  aliases.add(key);aliases.add(norm(canonical.ru));aliases.add(norm(canonical.display));
  for(const alias of canonical.aliases||[])aliases.add(norm(alias));
  const pools=[
   pool,window.__dbdCharacterCatalog,Object.values(window.characterPortraits||{}),
   typeof all!=='undefined'?all:[],
   typeof characterPortraits!=='undefined'?Object.values(characterPortraits):[]
  ];
  for(const source of pools){
   for(const record of poolRecords(source)){
    const matches=fieldValues(record,'character').some(field=>aliases.has(norm(field))||aliases.has(norm(field).replace(/^the/,'')));
    if(matches){
     const icon=canonical.icon||record.image||record.portrait||record.icon||'';
     return {
      ...record,
      id:record.id||slug(canonical.en),
      name:canonical.ru||record.name||canonical.en,
      nameEn:canonical.en,
      displayName:canonical.display||format(canonical.ru,canonical.en),
      role:canonical.role||record.role||record.type,
      type:record.type||canonical.role||record.role,
      category:record.category||(canonical.role==='killer'?'Убийца':'Выживший'),
      image:icon,portrait:icon,imageFull:icon,icon
     };
    }
   }
  }
  const icon=canonical.icon||'';
  return {
   id:slug(canonical.en),name:canonical.ru||canonical.en,nameEn:canonical.en,
   displayName:canonical.display||format(canonical.ru,canonical.en),
   role:canonical.role,type:canonical.role,
   category:canonical.role==='killer'?'Убийца':'Выживший',
   image:icon,portrait:icon,imageFull:icon,icon,
   synthetic:true
  };
 }
 window.DBD_NAME_DATA=DATA;
 window.dbdSplitDisplayName=splitDisplayName;
 window.dbdNormalizeName=norm;
 window.dbdNameKind=kindOf;
 window.dbdNameInfo=nameInfo;
 window.dbdDisplayName=displayName;
 window.dbdRecordEnglish=recordEnglish;
 window.dbdIsGeneralOwner=isGeneral;
 window.dbdCharacterKey=characterKey;
 window.dbdCharacterRecord=characterRecord;
})();

import {createHash} from 'node:crypto';

export class SalesError extends Error {
 constructor(public code:string, public status=400){super(code)}
}
export const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const TIMEZONE='America/Vancouver';
export const PARSER_VERSION='square-items-33-v1';
export const REQUIRED_HEADERS=['Date','Time','Time Zone','Category','Item','Qty','Price Point Name','SKU','Gross Sales','Discounts','Net Sales','Tax','Transaction ID','Payment ID','Unit','Count','Event Type','Location','Channel'];
export type SalesLine={rowHash:string;transactionId:string;paymentId:string;orderId:string|null;productKey:string;item:string;variant:string;sku:string;category:string;location:string;localDate:string;originalTimestamp:string;timezone:string;timestampStatus:string;soldAt:string;event:string;quantity:string;grossCents:number;discountCents:number;netCents:number;taxCents:number;refundCents:number};
export type CsvFile={name:string;bytes:Uint8Array;expectedHash?:string};
export type StageRow={ordinal:number;fileHash:string;sourceRow:number;rowHash:string;line:SalesLine|null;error:string|null};

// Strict RFC 4180 scanner. Quoted newlines are data; sourceRow is the CSV record
// number (header=1), not a physical text line. No excluded fields leave this parser.
export function csvRecords(text:string):string[][] {
 text=text.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true}}else field+=ch;continue;}
  if(ch==='"'){if(field||closed)throw new SalesError('CSV_QUOTES');quoted=true;continue;}
  if(ch===','||ch==='\n'||ch==='\r'){
   row.push(field);field='';closed=false;
   if(ch!==','){if(ch==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}
  }else{if(closed)throw new SalesError('CSV_QUOTES');field+=ch;}
  if(field.length>100000||rows.length>60000)throw new SalesError('CSV_LIMIT');
 }
 if(quoted)throw new SalesError('CSV_UNCLOSED_QUOTE');
 if(field||closed||row.length){row.push(field);rows.push(row);}
 return rows;
}
export function decimalUnits(raw:string,scale:number):number {
 let s=raw.trim(),negative=false;if(/^\(.*\)$/.test(s)){negative=true;s=s.slice(1,-1);}
 s=s.replace(/^CAD\s*/,'').replace(/^\$/,'');
 if(s.startsWith('-')){negative=!negative;s=s.slice(1).replace(/^\$/,'');}
 if(!new RegExp('^(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d{1,'+scale+'})?$').test(s))throw new SalesError('INVALID_DECIMAL');
 const [whole,decimal='']=s.replaceAll(',','').split('.');
 const n=Number(whole)*10**scale+Number(decimal.padEnd(scale,'0'));
 if(!Number.isSafeInteger(n)||n>1e12)throw new SalesError('AMOUNT_RANGE');return negative?-n:n;
}
export function validDay(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
export function localDay(iso:string){if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(iso)||!Number.isFinite(Date.parse(iso)))throw new SalesError('INVALID_TIMESTAMP');return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
function csvTimestamp(date:string,time:string,zone:string){
 if(!validDay(date)||!/^\d{2}:\d{2}:\d{2}$/.test(time)||Number(time.slice(0,2))>23||Number(time.slice(3,5))>59||Number(time.slice(6))>59||zone!==TIMEZONE)throw new SalesError('INVALID_SOURCE_TIME');
 const originalTimestamp=date+'T'+time,nominal=Date.parse(originalTimestamp+'Z');
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const candidates=[7,8].map(h=>nominal+h*3600000).filter(n=>fmt.format(new Date(n)).replace(' ','T')===originalTimestamp);
 if(!candidates.length)throw new SalesError('NONEXISTENT_SOURCE_TIME');
 // Keep ambiguous wall-clock data without manufacturing an offset. sold_at is
 // explicitly wall time for this case; reporting uses local_date, never DATE(sold_at).
 return {originalTimestamp,soldAt:candidates.length===1?new Date(candidates[0]).toISOString().slice(0,19).replace('T',' '):originalTimestamp.replace('T',' '),timestampStatus:candidates.length===1?'utc_resolved':'ambiguous_wall_time'};
}
function bounded(s:string,max=255,required=false){if(s.length>max||(required&&!s)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))throw new SalesError('INVALID_FIELD');return s;}
function project(headers:string[],row:string[],rowHash:string):SalesLine {
 if(row.length!==33)throw new SalesError('CSV_FIELD_COUNT');
 const r=Object.fromEntries(headers.map((h,i)=>[h,row[i]]));
 const event=r['Event Type'];if(!['Payment','Refund'].includes(event))throw new SalesError('UNSUPPORTED_EVENT');
 const grossCents=decimalUnits(r['Gross Sales'],2),netCents=decimalUnits(r['Net Sales'],2),rawDiscount=decimalUnits(r.Discounts,2),taxCents=decimalUnits(r.Tax,2);
 if(Math.abs(grossCents-netCents)!==Math.abs(rawDiscount))throw new SalesError('MONEY_RECONCILIATION');
 if(event==='Refund'&&(grossCents>0||netCents>0||taxCents>0))throw new SalesError('REFUND_SIGN_REVIEW');
 const qty=decimalUnits(r.Qty,4);if(event==='Payment'&&qty<0||event==='Refund'&&qty>0)throw new SalesError('QUANTITY_SIGN_REVIEW');
 const item=bounded(r.Item),variant=bounded(r['Price Point Name']),sku=bounded(r.SKU);
 const time=csvTimestamp(r.Date,r.Time,r['Time Zone']);
 return {rowHash,transactionId:bounded(r['Transaction ID'],191,true),paymentId:bounded(r['Payment ID'],191),orderId:null,
  productKey:hash(JSON.stringify(['csv',item,variant,sku])),item,variant,sku,category:bounded(r.Category),location:bounded(r.Location,191,true),
  localDate:r.Date,...time,timezone:r['Time Zone'],event,quantity:(qty/10000).toFixed(4),grossCents,discountCents:grossCents-netCents,netCents,taxCents,refundCents:event==='Refund'?-netCents:0};
}
export function previewCsv(files:CsvFile[]){
 if(!files.length||files.length>8||files.reduce((n,f)=>n+f.bytes.length,0)>40*1024*1024)throw new SalesError('FILE_LIMIT');
 const stages:StageRow[]=[],manifest:Array<{name:string;sha256:string;rows:number;headerHash:string}>=[],seenFiles=new Set<string>(),seenRows=new Set<string>(),transactions=new Set<string>(),products=new Set<string>();
 let duplicateFiles=0,duplicates=0,rejected=0,rawRows=0,netCents=0,minDate:string|null=null,maxDate:string|null=null,headerHash='';
 for(const file of files){
  const sha256=hash(file.bytes);if(file.expectedHash&&file.expectedHash!==sha256)throw new SalesError('FILE_HASH_MISMATCH');
  if(seenFiles.has(sha256)){duplicateFiles++;continue;}seenFiles.add(sha256);
  const records=csvRecords(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes)),headers=records.shift()||[];
  if(headers.length!==33||new Set(headers).size!==33||REQUIRED_HEADERS.some(h=>!headers.includes(h)))throw new SalesError('UNRECOGNIZED_33_FIELD_EXPORT');
  const hh=hash(JSON.stringify(headers));if(headerHash&&headerHash!==hh)throw new SalesError('EXPORT_SCHEMA_MISMATCH');headerHash=hh;
  manifest.push({name:bounded(file.name.replace(/^.*[\\/]/,''),240,true),sha256,rows:records.length,headerHash:hh});rawRows+=records.length;if(rawRows>60000)throw new SalesError('CSV_LIMIT');
  for(let i=0;i<records.length;i++){
   const row=records[i],rowHash=hash(JSON.stringify(row));let line:SalesLine|null=null,error:string|null=null;
   try{line=project(headers,row,rowHash);}catch(e){if(!(e instanceof SalesError))throw e;error=e.code;rejected++;}
   stages.push({ordinal:stages.length+1,fileHash:sha256,sourceRow:i+2,rowHash,line,error});
   if(!line)continue;if(seenRows.has(rowHash)){duplicates++;continue;}seenRows.add(rowHash);
   netCents+=line.netCents;if(!Number.isSafeInteger(netCents))throw new SalesError('TOTAL_RANGE');transactions.add(line.transactionId);products.add(line.productKey);
   minDate=minDate===null||line.localDate<String(minDate)?line.localDate:minDate;maxDate=maxDate===null||line.localDate>String(maxDate)?line.localDate:maxDate;
  }
 }
 const id=hash(JSON.stringify([PARSER_VERSION,manifest.map(f=>f.sha256).sort()]));
 return {id,manifest,stages,preview:{parserVersion:PARSER_VERSION,rawRows,duplicateFiles,duplicates,rejected,uniqueRows:seenRows.size,transactions:transactions.size,sourceProducts:products.size,netCents,minDate,maxDate,coverage:'Observed records only; gaps are unknown, not zero sales.',currency:'CAD',timezone:TIMEZONE,tipsAvailable:false,paymentTotalsAvailable:false}};
}

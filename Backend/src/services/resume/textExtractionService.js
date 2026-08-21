const fs=require('fs/promises');
const {PDFParse}=require('pdf-parse');
const mammoth=require('mammoth');

function normalizeText(value){
  return String(value||'')
    .normalize('NFKC')
    .replace(/\r\n?/g,'\n')
    .replace(/[\t\f\v]+/g,' ')
    .split('\n')
    .map(line=>line.replace(/ {2,}/g,' ').trim())
    .join('\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

async function extractResumeText(filePath,mimeType){
  let text='';
  if(mimeType==='application/pdf'){
    const parser=new PDFParse({data:new Uint8Array(await fs.readFile(filePath))});
    try{const result=await parser.getText();text=result.text}finally{await parser.destroy()}
  }else if(mimeType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
    const result=await mammoth.extractRawText({path:filePath});
    text=result.value;
  }else{
    throw new Error('Unsupported resume file type');
  }
  const normalized=normalizeText(text);
  if(!normalized)throw new Error('No readable text was found in this resume');
  return normalized;
}

module.exports={extractResumeText,normalizeText};

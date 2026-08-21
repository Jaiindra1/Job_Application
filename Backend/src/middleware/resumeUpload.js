const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const multer=require('multer');

const uploadDirectory=path.resolve(__dirname,'../../uploads/resumes');
fs.mkdirSync(uploadDirectory,{recursive:true});
const allowed={
  '.pdf':'application/pdf',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const storage=multer.diskStorage({
  destination:(req,file,callback)=>callback(null,uploadDirectory),
  filename:(req,file,callback)=>callback(null,`${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload=multer({
  storage,
  limits:{fileSize:5*1024*1024,files:1},
  fileFilter:(req,file,callback)=>{
    const extension=path.extname(file.originalname).toLowerCase();
    if(!allowed[extension]||allowed[extension]!==file.mimetype)return callback(Object.assign(new Error('Only valid PDF and DOCX files are allowed'),{statusCode:400}));
    callback(null,true);
  },
});
module.exports={uploadResume:upload.single('resume'),uploadDirectory};

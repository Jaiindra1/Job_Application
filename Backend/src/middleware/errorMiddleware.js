function notFound(req,res){res.status(404).json({success:false,message:`Route not found: ${req.method} ${req.originalUrl}`})}
function errorHandler(err,req,res,next){
  if(res.headersSent)return next(err);
  let status=err.statusCode||500,message=err.message||'Internal server error';
  if(err.name==='MulterError'){
    status=400;
    message=err.code==='LIMIT_FILE_SIZE'?'Resume must be 5 MB or smaller':'Unable to upload this file';
  }
  if(err.name==='ValidationError')status=400;
  if(err.name==='CastError'){status=400;message='Invalid identifier'}
  if(err.code===11000){status=409;message='This record already exists'}
  res.status(status).json({success:false,message,...(process.env.NODE_ENV==='development'&&{error:err.message})});
}
module.exports={notFound,errorHandler};

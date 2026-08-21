const express=require('express');
const cors=require('cors');
require('dotenv').config();
const connectDB=require('./config/database\_connection');
const {notFound,errorHandler}=require('./middleware/errorMiddleware');
const app=express();
app.disable('x-powered-by');
app.use(
cors({
origin: "[https://job-application-jade.vercel.app](https://job-application-jade.vercel.app)",
methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
allowedHeaders: ["Content-Type", "Authorization"],
})
);
const allowedOrigins=(process.env.CORS\_ORIGIN||'[http://localhost:5173](http://localhost:5173)').split(',').map(value=>value.trim()).filter(Boolean);
app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.includes(origin))return callback(null,true);const error=new Error('Origin is not allowed by CORS');error.statusCode=403;callback(error)},methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization'],maxAge:600}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');next()});
app.use(express.json({limit:'1mb'}));
app.get('/',(req,res)=>res.json({success\:true,message:'Job Search Assistant API is running',data:{status:'ok'}}));
app.use('/api/auth',require('./routes/authRoutes'));
app.use('/api/jobs',require('./routes/jobRoutes'));
app.use('/api/saved-jobs',require('./routes/savedJobRoutes'));
app.use('/api/savedJobs',require('./routes/savedJobRoutes'));
app.use('/api/applications',require('./routes/applicationRoutes'));
app.use('/api/profile',require('./routes/profileRoutes'));
app.use('/api/resume',require('./routes/resumeRoutes'));
app.use('/api/dashboard',require('./routes/dashboardRoutes'));
app.use('/api/companies',require('./routes/companyRoutes'));
app.use('/api/gmail',require('./routes/gmailRoutes'));
app.use('/api/notifications',require('./routes/notificationRoutes'));
app.use('/api/auto-apply',require('./routes/autoApplyRoutes'));
app.use(notFound);
app.use(errorHandler);
const PORT=Number(process.env.PORT)||7000;
async function start(){await connectDB();require('./services/autoApply/autoApplyScheduler').startAutoApplyRuntime();return app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`))}
if(require.main===module)start();
module.exports={app,start};
re write

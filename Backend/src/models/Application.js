const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "Applied",
        "Prepared",
        "Queued",
        "Application Received",
        "Assessment",
        "Interview",
        "Offer",
        "Rejected",
        "Failed",
        "Needs Review",
        "Withdrawn",
      ],
      default: "Applied",
    },

    appliedAt: {
      type: Date,
      default: Date.now,
    },

    nextAction: {
      type: String,
      default: "",
    },

    nextActionDate: {
      type: Date,
    },

    notes: {
      type: String,
      default: "",
    },
    source:{type:String,enum:['MANUAL','GMAIL','SYSTEM','AUTO_APPLY'],default:'MANUAL'},
    submissionMethod:{type:String,enum:['MANUAL','AUTOMATIC'],default:'MANUAL'},
    applicationPlatform:{type:String,enum:['GREENHOUSE','LEVER','WORKDAY','SMARTRECRUITERS','ASHBY','ICIMS','DARWINBOX','SUCCESSFACTORS','ADP','UNKNOWN'],default:'UNKNOWN'},
    autoApplyDraftId:{type:mongoose.Schema.Types.ObjectId,ref:'AutoApplyDraft',default:null},
    submittedAt:{type:Date,default:null},
    externalApplicationId:{type:String,default:''},
    applicationUrl:{type:String,default:''},
    resumeId:{type:mongoose.Schema.Types.ObjectId,ref:'Resume',default:null},
    coverLetterId:{type:mongoose.Schema.Types.ObjectId,ref:'CoverLetterDraft',default:null},
    preparationMetadata:{type:mongoose.Schema.Types.Mixed,default:{}},
  },
  {
    timestamps: true,
  }
);
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ userId: 1, status: 1 });

const Application = mongoose.model("Application", applicationSchema);

module.exports = Application;

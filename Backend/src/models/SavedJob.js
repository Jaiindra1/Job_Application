const mongoose = require("mongoose");

const savedJobSchema = new mongoose.Schema(
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

    notes: {
      type: String,
      default: "",
    },
    savedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);
savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const SavedJob = mongoose.model("SavedJob", savedJobSchema);

module.exports = SavedJob;

const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    skills: {
      type: [String],
      default: [],
    },

    experience: {
      type: String,
      default: "",
    },

    salary: {
      type: String,
      default: "",
    },

    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Other"],
      default: "Full-time",
    },

    workMode: {
      type: String,
      enum: ["Remote", "Hybrid", "On-site", "Unknown", "Other"],
      default: "Unknown",
    },

    source: {
      type: String,
      required: true,
      trim: true,
    },

    sourceJobId: {
      type: String,
      required: true,
      trim: true,
    },

    originalUrl: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } },
        message: 'Original job URL must use HTTP or HTTPS',
      },
    },

    postedAt: {
      type: Date,
    },

    fetchedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    staleAt: { type: Date, default: () => new Date(Date.now() + 48 * 3600000), index: true },
    expiredAt: { type: Date, default: null, index: true },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    salaryCurrency: { type: String, default: '' },
    salaryPeriod: { type: String, default: '' },
    category: { type: String, enum: ['IT', 'NON_IT', 'UNKNOWN'], default: 'UNKNOWN', index: true },
    subcategory: { type: String, default: null, index: true },
    categoryConfidence: { type: Number, min: 0, max: 1, default: 0 },
    classificationVersion: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);
jobSchema.index({ source: 1, sourceJobId: 1 }, { unique: true });
jobSchema.index({ title: "text", company: "text", description: "text", skills: "text" });
jobSchema.index({ isActive: 1, staleAt: 1, postedAt: -1 });
jobSchema.index({ category: 1, subcategory: 1, postedAt: -1 });

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;

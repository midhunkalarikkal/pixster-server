import mongoose from "mongoose";

const signedUrlCacheSchema = new mongoose.Schema({
    key : {
        type: String,
        required: true,
        unique: true,
    },
    url : {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        require: true,
        index : {
            expires : 0
        }
    }
});

const SignedUrlCache = mongoose.model("SignedUrlCache", signedUrlCacheSchema);
export default SignedUrlCache;
import mongoose from "mongoose";

const savedSchema = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true,
        ref : "User"
    },
    postId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true,
        ref : "Post"
    }
},{
    timestamps : true
});

savedSchema.index({ userId : 1, postId : 1}, { unique : true });

const Saved = mongoose.model("Saved",savedSchema);
export default Saved;
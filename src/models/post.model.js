import mongoose from "mongoose";

const postModel = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true,
        ref : "User"
    },
    media : {
        type : String,
    },
    content : {
        type : String,
        required : true,
        minLength : 1,
        maxLength : 500,
    },
    likes : {
        type : Number,
        default : 0,
        min : 0,
    },
    commentsCount: {
        type : Number,
        default : 0,
    },
    type : {
        type : String,
        enum : ["Post", "Thread"],
    }
}, {
    timestamps: true
});

const Post = mongoose.model("Post",postModel);
export default Post;


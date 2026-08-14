import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
    postId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Post',
        required : true,
    },
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true,
    },
    content : {
        type : String,
        required : true,
        maxLength : 200,
        minLength : 1,
        required : true,
    },
    likes : {
        type : Number,
        default : 0,
        min : 0,
    },
    isRootComment : {
        type : Boolean,
        required : true,
        default : false,
    },
    parentCommentId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Comment",
        default : null,
    },
},{
    timestamps : true,
});

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
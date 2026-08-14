import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true,
        ref : "User"
    },
    img : {
        type : String,
        required : true,
    },
    expiresAt : {
        type : Date,
        default : () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        index : { expires : 0 }
    }
},{
    timestamps :  true
});

const Story = mongoose.model("Story", storySchema);
export default Story;
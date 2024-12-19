import mongoose from 'mongoose';

const liveSchema = new mongoose.Schema({
    cardNumber: String,
    month: String,
    year: String,
    cvv: String,
    result: String,
    message: String,
    gate: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const Live = mongoose.model('Live', liveSchema);

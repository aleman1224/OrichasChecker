import mongoose from 'mongoose';

const liveSchema = new mongoose.Schema({
    cardNumber: {
        type: String,
        required: true,
        trim: true
    },
    month: {
        type: String,
        required: true
    },
    year: {
        type: String,
        required: true
    },
    cvv: {
        type: String,
        required: true
    },
    result: {
        type: String,
        enum: ['live', 'dead'],
        required: true
    },
    message: String,
    gate: {
        type: String,
        enum: ['elegbagate', 'oshungate'],
        required: true
    },
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

// Índices para mejorar el rendimiento
liveSchema.index({ userId: 1, createdAt: -1 });
liveSchema.index({ gate: 1, createdAt: -1 });

export const Live = mongoose.model('Live', liveSchema);

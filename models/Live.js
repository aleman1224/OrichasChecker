import mongoose from 'mongoose';

const liveSchema = new mongoose.Schema({
    cardNumber: {
        type: String,
        required: true,
        trim: true
    },
    month: {
        type: String,
        required: true,
        trim: true
    },
    year: {
        type: String,
        required: true,
        trim: true
    },
    cvv: {
        type: String,
        required: true,
        trim: true
    },
    result: {
        type: String,
        enum: ['CVV', 'FUNDS', 'CHARGED', 'DEAD'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    gate: {
        type: String,
        required: true,
        default: 'elegbagate'
    },
    userId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índices para mejorar el rendimiento de las consultas
liveSchema.index({ cardNumber: 1 });
liveSchema.index({ userId: 1 });
liveSchema.index({ result: 1 });
liveSchema.index({ createdAt: -1 });

export const Live = mongoose.model('Live', liveSchema);

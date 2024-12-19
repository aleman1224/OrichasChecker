// models/Key.js
import mongoose from 'mongoose';

const keySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    userId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'banned'],
        default: 'active'
    },
    validUntil: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsed: {
        type: Date,
        default: null
    },
    usageCount: {
        type: Number,
        default: 0
    }
});

// Índices para mejorar el rendimiento
keySchema.index({ userId: 1 });
keySchema.index({ status: 1 });
keySchema.index({ validUntil: 1 });

// Método para verificar si la key está activa
keySchema.methods.isActive = function() {
    return this.status === 'active' && this.validUntil > new Date();
};

// Método para incrementar el contador de uso
keySchema.methods.incrementUsage = async function() {
    this.usageCount += 1;
    this.lastUsed = new Date();
    await this.save();
};

export const Key = mongoose.model('Key', keySchema);
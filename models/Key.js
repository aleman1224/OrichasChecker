// models/Key.js
import mongoose from 'mongoose';

const keySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    daysValidity: {
        type: Number,
        required: true,
        default: 30
    },
    used: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

// Middleware para calcular expiresAt
keySchema.pre('save', function(next) {
    if (!this.expiresAt) {
        this.expiresAt = new Date(this.createdAt.getTime() + this.daysValidity * 24 * 60 * 60 * 1000);
    }
    next();
});

// Método para verificar si la clave es válida
keySchema.methods.isValid = function() {
    return !this.used && new Date() <= this.expiresAt;
};

export const Key = mongoose.model('Key', keySchema);
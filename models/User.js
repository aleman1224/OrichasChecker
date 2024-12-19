// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    key: {                    
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    subscription: {
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: true
        },
        daysValidity: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['active', 'expired'],
            default: 'active'
        }
    }
});

// Método para comparar contraseñas (versión simple)
userSchema.methods.comparePassword = function(candidatePassword) {
    return this.password === candidatePassword;
};

export const User = mongoose.model('User', userSchema);
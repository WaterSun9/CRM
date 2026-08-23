import { z } from 'zod';

const emptyToUndefined = (schema) => z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
}, schema);

export const leadSchema = z.object({
    customer_name: z.string({
        required_error: "Customer Name is required",
    })
    .min(2, "Customer Name must be at least 2 characters")
    .max(100, "Customer Name cannot exceed 100 characters")
    .trim(),
    
    phone_number: z.string({
        required_error: "Phone Number is required",
    })
    .regex(/^[0-9]{10}$/, "Phone Number must be exactly 10 digits"),
    
    email_address: emptyToUndefined(z.string().email("Invalid email format").trim().optional()),
    
    consumer_no: z.string({
        required_error: "Consumer Number is required",
    })
    .min(3, "Consumer/EB Number must be at least 3 characters")
    .max(30, "Consumer/EB Number cannot exceed 30 characters")
    .trim(),

    villages: z.string({
        required_error: "Villages / Address is required",
    })
    .min(3, "Address must be at least 3 characters")
    .trim(),

    channel_partner: z.string({
        required_error: "Channel Partner Name is required",
    })
    .min(1, "Channel Partner Name is required")
    .trim(),

    module_brand: z.string({
        required_error: "Module Brand is required",
    })
    .min(1, "Module Brand is required")
    .trim(),

    module_wp: z.string({
        required_error: "Module Wp is required",
    })
    .min(1, "Module Wp is required"),

    no_of_modules: z.string({
        required_error: "No of Modules is required",
    })
    .min(1, "No of Modules is required"),

    system_capacity_kwp: z.string({
        required_error: "System Capacity is required",
    })
    .min(1, "System Capacity is required"),

    sub_divisions: z.string({
        required_error: "Sub Division is required",
    })
    .min(1, "Sub Division is required")
    .trim(),

    payment_type: z.enum(['CASH', 'LOAN'], {
        errorMap: () => ({ message: "Payment Type must be either CASH or LOAN" })
    }),
});

export const customerSchema = leadSchema.partial();

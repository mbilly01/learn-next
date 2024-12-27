'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
    id : z.string(),
    customerId: z.string({
        invalid_type_error: 'Please Select A Customer.',
    }),
    amount : z.coerce.number().gt(0, { message: 'Please Enter An Amount Greater Than $0'}),
    status : z.enum(['pending','paid'], {
        invalid_type_error: 'Please Select An Invoice Status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id : true, date : true});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
}

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId : formData.get('customerId'),
        amount : formData.get('amount'),
        status : formData.get('status'),
    });
    
    // If form validation fails, return errors early.
    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: 'Missing Fields. Failed to Create Invoice.',
        };
      }
    
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    //Insert data into the database
    try {
        await sql `INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message : 'Database Error : Failed To Create Invoice',
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({id : true, date: true});

export async function updateInvoice(
    id:string,
    prevState: State,
    formData:FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId : formData.get('customerId'),
        amount : formData.get('amount'),
        status: formData.get('status'),
    })

    if(!validatedFields.success) {
        return {
            errors : validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed To Update Invoice',
        }
    }

    const {customerId,amount, status} = validatedFields.data;
    const amountInCents = amount * 100

    try {
        await sql`
    UPDATE invcoices SET customer_id = ${customerId}, amount=${amountInCents}, status = ${status} WHERE id = ${id}
    `;

    } catch (error) {
        return {
            message : 'Database Error : Failed To Update Invoice'
        }
    }

    

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id : string) {
    try {
        await sql `DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message : 'Deleted Invoice'};  
    } catch(error) {
        return { message : 'Database Error : Failed To Delete Invoice'};
    }
  
}

export async function authenticate(
    prevState : string | undefined,
    formData : FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials';
                default:
                    return 'Something Went Wrong';
            }
        }
        throw error;
    }
}
import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client();

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';

client
    .setEndpoint(endpoint)
    .setProject(projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };

export const APPWRITE_CONFIG = {
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'mei_lunch_db',
    usersCollectionId: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_USERS_ID || 'users',
    passesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PASSES_ID || 'passes',
};

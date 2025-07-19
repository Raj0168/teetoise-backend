const SibApiV3Sdk = require('sib-api-v3-sdk');
require('dotenv').config();

// Configure Brevo API
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// Create an instance of the EmailCampaignsApi
const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();

// Define the campaign settings
const emailCampaigns = new SibApiV3Sdk.CreateEmailCampaign();
emailCampaigns.name = "Campaign sent via the API";
emailCampaigns.subject = "My subject";
emailCampaigns.sender = { "name": "From name", "email": "myfromemail@mycompany.com" };
emailCampaigns.type = "classic";
emailCampaigns.htmlContent = '<p>Congratulations! You successfully sent this example campaign via the Brevo API.</p>';
emailCampaigns.recipients = { listIds: [2, 7] }; // Replace with your list IDs
emailCampaigns.scheduledAt = new Date(new Date().getTime() + 3600 * 1000).toISOString(); // Schedule in one hour

// Make the call to create the campaign
apiInstance.createEmailCampaign(emailCampaigns).then(data => {
  console.log('API called successfully. Returned data:', data);
}).catch(error => {
  console.error('Error occurred:', error);
});

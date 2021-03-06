using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using OCM.API.Common.Model;
using System.Collections;
using System.Configuration;
using Newtonsoft.Json;
using OCM.Core.Data;

namespace OCM.API.Common
{
    /// <summary>
    /// Used to perform a data submission.
    /// </summary>
    public class SubmissionManager
    {
        public bool AllowUpdates = false;
        public bool RequireSubmissionReview = true;

        public SubmissionManager()
        {
            AllowUpdates = false;
        }

        //convert a simple POI to data and back again to fully populate all related properties, as submission may only have simple IDs for ref data etc
        private Model.ChargePoint PopulateFullPOI(Model.ChargePoint poi)
        {
            OCMEntities tempDataModel = new OCMEntities();
            var poiData = new Core.Data.ChargePoint();
            if (poi.ID > 0) poiData = tempDataModel.ChargePoints.First(c => c.ID == poi.ID);

            //convert simple poi to fully populated db version
            new POIManager().PopulateChargePoint_SimpleToData(poi, poiData, tempDataModel);

            //convert back to simple POI
            var modelPOI = Model.Extensions.ChargePoint.FromDataModel(poiData);
            
            //clear temp changes from the poi
            //dataModel.Entry(poiData).Reload();
            tempDataModel.Dispose();
            return modelPOI;
        }

        /// <summary>
        /// Consumers should prepare a new/updated ChargePoint with as much info populated as possible
        /// </summary>
        /// <param name="submission">ChargePoint info for submission, if ID and UUID set will be treated as an update</param>
        /// <returns>false on error or not enough data supplied</returns>
        public bool PerformSubmission(Model.ChargePoint poi, Model.User user)
        {
            try
            {
                var cpManager = new POIManager();
                bool enableEditQueue = bool.Parse(ConfigurationManager.AppSettings["EnableEditQueue"]);
                bool addToQueueAndDB = true; //if true item is entered in edit queue and to the ChargePoint list in db
                bool isUpdate = false;
                bool userCanEdit = false;

                //if user signed in, check if they have required permission to perform an edit/approve (if required)
                if (user != null)
                {
                    int? countryId = (poi.AddressInfo != null && poi.AddressInfo.Country != null) ? (int?)poi.AddressInfo.Country.ID : null;

                    if (UserManager.IsUserAdministrator(user) || UserManager.HasUserPermission(user, StandardPermissionAttributes.CountryLevel_Editor, "All") || (countryId != null && UserManager.HasUserPermission(user, StandardPermissionAttributes.CountryLevel_Editor, countryId.ToString())))
                    {
                        userCanEdit = true;
                    }

                    //if user is system user, edits/updates are not recorded in edit queue
                    if (user.ID == (int)StandardUsers.System)
                    {
                        enableEditQueue = false;
                    }
                }

                var dataModel = new Core.Data.OCMEntities();

                if (poi.ID > 0 && !String.IsNullOrEmpty(poi.UUID))
                {
                    //poi is an update, validate
                    if (dataModel.ChargePoints.Any(c => c.ID == poi.ID && c.UUID == poi.UUID))
                    {
                        //update is valid poi, check if user has permission to perform an update
                        isUpdate = true;
                        if (userCanEdit) AllowUpdates = true;
                        if (!AllowUpdates && !enableEditQueue)
                        {
                            return false; //valid update requested but updates not allowed
                        }
                    }
                    else
                    {
                        //update does not correctly identify an existing poi
                        return false;
                    }

                    //validate if minimal required data is present
                    if (poi.AddressInfo.Title==null || poi.AddressInfo.Country == null || poi.AddressInfo.Latitude == null || poi.AddressInfo.Longitude == null)
                    {
                        return false;
                    }
                }

                //convert to DB version of POI and back so that properties are fully populated
                poi = PopulateFullPOI(poi);

                //if user cannot edit, add to edit queue for approval
                var editQueueItem = new Core.Data.EditQueueItem { DateSubmitted = DateTime.UtcNow };
                if (enableEditQueue)
                {
                    editQueueItem.EntityID = poi.ID;
                    editQueueItem.EntityType = dataModel.EntityTypes.FirstOrDefault(t => t.ID == 1);
                    //charging point location entity type id

                    //serialize cp as json
                    var jsonOutput = new OutputProviders.JSONOutputProvider();

                    //null extra data we don't want to serialize/compare
                    poi.UserComments = null;
                    poi.MediaItems = null;

                    string editData = jsonOutput.PerformSerialisationToString(poi, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });

                    editQueueItem.EditData = editData;

                    if (poi.ID > 0)
                    {
                        //get json snapshot of current cp data to store as 'previous'
                        var currentPOI = cpManager.Get(poi.ID);

                        //check if poi will change with this edit, if not we discard it completely
                        if (!cpManager.HasDifferences(currentPOI, poi))
                        {
                            return false;
                        }
                        else
                        {
                            editQueueItem.PreviousData = jsonOutput.PerformSerialisationToString(currentPOI, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });
                        }
                    }

                    if (user != null) editQueueItem.User = dataModel.Users.FirstOrDefault(u => u.ID == user.ID);
                    editQueueItem.IsProcessed = false;
                    editQueueItem = dataModel.EditQueueItems.Add(editQueueItem);
                    //TODO: send notification of new item for approval

                    dataModel.SaveChanges();

                    //if previous edit queue item exists by same user for same POI, mark as processed
                    var previousEdits = dataModel.EditQueueItems.Where(e => e.UserID == editQueueItem.UserID && e.EntityID == editQueueItem.EntityID && e.EntityTypeID == editQueueItem.EntityTypeID && e.ID != editQueueItem.ID && e.IsProcessed != true);
                    foreach (var previousEdit in previousEdits)
                    {
                        previousEdit.IsProcessed = true;
                        if (editQueueItem.User != null)
                        {
                            previousEdit.ProcessedByUser = editQueueItem.User;
                        }
                        else
                        {
                            editQueueItem.ProcessedByUser = dataModel.Users.FirstOrDefault(u => u.ID == (int)StandardUsers.System);
                        }
                        previousEdit.DateProcessed = DateTime.UtcNow;

                    }
                    dataModel.SaveChanges();
                }

                //prepare and save changes POI changes/addition

                int newID = 0;


                if (isUpdate && !AllowUpdates)
                {
                    //user has submitted an edit but is not an approved editor

                    try
                    {
                        string approvalStatus = "Edit Submitted for approval";

                        //send notification
                        var notification = new NotificationManager();
                        var msgParams = new Hashtable();
                        msgParams.Add("Description", "OCM-" + poi.ID + " : " + poi.AddressInfo.Title);
                        msgParams.Add("SubmissionStatusType", approvalStatus);

                        msgParams.Add("UserName", user != null ? user.Username : "Anonymous");
                        msgParams.Add("MessageBody",
                                      "Edit item for Approval: Location " + approvalStatus + " OCM-" + poi.ID + " Submitted: " +
                                      poi.AddressInfo.Title);

                        notification.PrepareNotification(NotificationType.LocationSubmitted, msgParams);

                        //notify default system recipients
                        notification.SendNotification(NotificationType.LocationSubmitted);
                    }
                    catch (Exception)
                    {
                        ;
                        ; //failed to send notification
                    }

                    //item is in edit queue for approval.
                    return true;
                }

                if (addToQueueAndDB)
                {


                    //updates allowed for this user, go ahead and store the update
                    var cpData = new Core.Data.ChargePoint();
                    if (isUpdate) cpData = dataModel.ChargePoints.First(c => c.ID == poi.ID);

                    //set/update cp properties
                    cpManager.PopulateChargePoint_SimpleToData(poi, cpData, dataModel);

                    //if item has no submission status and user permitted to edit, set to published
                    if (userCanEdit && cpData.SubmissionStatusTypeID == null)
                    {
                        cpData.SubmissionStatusType = dataModel.SubmissionStatusTypes.First(s => s.ID == (int)StandardSubmissionStatusTypes.Submitted_Published);
                    }

                    if (!isUpdate)
                    {
                        //new data objects need added to data model before save
                        if (cpData.AddressInfo != null) dataModel.AddressInfoList.Add(cpData.AddressInfo);

                        dataModel.ChargePoints.Add(cpData);
                    }
                    else
                    {
                        cpData.DateLastStatusUpdate = DateTime.UtcNow;
                    }

                    //save poi
                    dataModel.SaveChanges();

                    newID = cpData.ID;

                    //is an authorised update, reflect change in edit queue item
                    if (enableEditQueue && user != null && user.ID > 0)
                    {
                        var editUser = dataModel.Users.FirstOrDefault(u => u.ID == user.ID);
                        editQueueItem.User = editUser;

                        if (newID > 0) editQueueItem.EntityID = newID;

                        //if user is authorised to edit, process item automatically without review
                        if (userCanEdit)
                        {
                            editQueueItem.ProcessedByUser = editUser;
                            editQueueItem.DateProcessed = DateTime.UtcNow;
                            editQueueItem.IsProcessed = true;
                        }

                        dataModel.SaveChanges();
                    }
                    else
                    {
                        //anonymous submission, update edit queue item
                        if (enableEditQueue && user == null)
                        {
                            if (newID > 0) editQueueItem.EntityID = newID;
                            dataModel.SaveChanges();
                        }
                    }

                    System.Diagnostics.Debug.WriteLine("Added/Updated CP:" + cpData.ID);

                    if (user != null)
                    {
                        AuditLogManager.Log(user, isUpdate ? AuditEventType.UpdatedItem : AuditEventType.CreatedItem, "Modified OCM-" + cpData.ID, null);
                        //add reputation points
                        new UserManager().AddReputationPoints(user, 1);
                    }

                    //if new item added, send notification
                    if (!isUpdate)
                    {
                        try
                        {
                            string approvalStatus = cpData.SubmissionStatusType.Title;

                            //send notification
                            NotificationManager notification = new NotificationManager();
                            Hashtable msgParams = new Hashtable();
                            msgParams.Add("Description", "OCM-" + cpData.ID + " : " + poi.AddressInfo.Title);
                            msgParams.Add("SubmissionStatusType", approvalStatus);

                            msgParams.Add("UserName", user != null ? user.Username : "Anonymous");
                            msgParams.Add("MessageBody",
                                          "New Location " + approvalStatus + " OCM-" + cpData.ID + " Submitted: " +
                                          poi.AddressInfo.Title);

                            notification.PrepareNotification(NotificationType.LocationSubmitted, msgParams);

                            //notify default system recipients
                            notification.SendNotification(NotificationType.LocationSubmitted);
                        }
                        catch (Exception)
                        {
                            ;
                            ; //failed to send notification
                        }
                    }

                }

                return true;
            }
            catch (Exception exp)
            {

                System.Diagnostics.Debug.WriteLine(exp.ToString());
                //throw exp;
                //error performing submission
                return false;
            }
        }

        /// <summary>
        /// Submit a new comment against a given charge equipment id
        /// </summary>
        /// <param name="comment"></param>
        /// <returns>ID of new comment, -1 for invalid cp, -2 for general error saving comment</returns>
        public int PerformSubmission(Common.Model.UserComment comment, Model.User user)
        {
            //populate data model comment from simple comment object

            var dataModel = new Core.Data.OCMEntities();
            int cpID = comment.ChargePointID;
            var dataComment = new Core.Data.UserComment();
            dataComment.ChargePoint = dataModel.ChargePoints.FirstOrDefault(c => c.ID == cpID);

            if (dataComment.ChargePoint == null) return -1; //invalid charge point specified

            dataComment.Comment = comment.Comment;
            int commentTypeID = 10; //default to General Comment
            if (comment.CommentType != null) commentTypeID = comment.CommentType.ID;
            dataComment.UserCommentType = dataModel.UserCommentTypes.FirstOrDefault(t => t.ID == commentTypeID);
            if (comment.CheckinStatusType != null) dataComment.CheckinStatusType = dataModel.CheckinStatusTypes.FirstOrDefault(t => t.ID == comment.CheckinStatusType.ID);
            dataComment.UserName = comment.UserName;
            dataComment.Rating = comment.Rating;
            dataComment.RelatedURL = comment.RelatedURL;
            dataComment.DateCreated = DateTime.UtcNow;

            if (user != null && user.ID > 0)
            {
                var ocmUser = dataModel.Users.FirstOrDefault(u => u.ID == user.ID);

                if (ocmUser != null)
                {
                    dataComment.User = ocmUser;
                    dataComment.UserName = ocmUser.Username;
                }
            }

            try
            {
                dataModel.UserComments.Add(dataComment);
                dataModel.SaveChanges();

                if (user != null)
                {
                    AuditLogManager.Log(user, AuditEventType.CreatedItem, "Added Comment " + dataComment.ID + " to OCM-" + cpID, null);
                    //add reputation points
                    new UserManager().AddReputationPoints(user, 1);
                }

                try
                {
                    //prepare notification
                    NotificationManager notification = new NotificationManager();
                    Hashtable msgParams = new Hashtable();
                    msgParams.Add("Description", "");
                    msgParams.Add("ChargePointID", comment.ChargePointID);
                    msgParams.Add("ItemURL", "http://openchargemap.org/site/poi/details/" + comment.ChargePointID);
                    msgParams.Add("UserName", user != null ? user.Username : comment.UserName);
                    msgParams.Add("MessageBody", "Comment (" + dataComment.UserCommentType.Title + ") added to OCM-" + comment.ChargePointID + ": " + dataComment.Comment);

                    //if fault report, attempt to notify operator
                    if (dataComment.UserCommentType.ID == (int)StandardCommentTypes.FaultReport)
                    {
                        //decide if we can send a fault notification to the operator
                        notification.PrepareNotification(NotificationType.FaultReport, msgParams);

                        //notify default system recipients
                        bool operatorNotified = false;
                        if (dataComment.ChargePoint.Operator != null)
                        {
                            if (!String.IsNullOrEmpty(dataComment.ChargePoint.Operator.FaultReportEmail))
                            {
                                try
                                {
                                    notification.SendNotification(dataComment.ChargePoint.Operator.FaultReportEmail, ConfigurationManager.AppSettings["DefaultRecipientEmailAddresses"].ToString());
                                    operatorNotified = true;
                                }
                                catch (Exception)
                                {
                                    System.Diagnostics.Debug.WriteLine("Fault report: failed to notify operator");
                                }
                            }
                        }

                        if (!operatorNotified)
                        {
                            notification.Subject += " (OCM: Could not notify Operator)";
                            notification.SendNotification(NotificationType.LocationCommentReceived);
                        }
                    }
                    else
                    {
                        //normal comment, notification to OCM only
                        notification.PrepareNotification(NotificationType.LocationCommentReceived, msgParams);

                        //notify default system recipients
                        notification.SendNotification(NotificationType.LocationCommentReceived);
                    }

                }
                catch (Exception)
                {
                    ; ; // failed to send notification
                }

                return dataComment.ID;
            }
            catch (Exception)
            {
                return -2; //error saving
            }

        }

        public int PerformSubmission(Common.Model.MediaItem mediaItem, Model.User user)
        {
            return -1;
        }

        public bool SubmitContactSubmission(ContactSubmission contactSubmission)
        {
            return SendContactUsMessage(contactSubmission.Name, contactSubmission.Email, contactSubmission.Comment);
        }

        public bool SendContactUsMessage(string senderName, string senderEmail, string comment)
        {
            try
            {
                //send notification
                NotificationManager notification = new NotificationManager();
                Hashtable msgParams = new Hashtable();
                msgParams.Add("Description", (comment.Length > 64 ? comment.Substring(0, 64) + ".." : comment));
                msgParams.Add("Name", senderName);
                msgParams.Add("Email", senderEmail);
                msgParams.Add("Comment", comment);

                notification.PrepareNotification(NotificationType.ContactUsMessage, msgParams);

                //notify default system recipients
                notification.SendNotification(NotificationType.ContactUsMessage);
                return true;
            }
            catch (Exception)
            {
                return false; //failed
            }
        }

        public void TestSubmission()
        {
            Model.ChargePoint cp = new Model.ChargePoint();
            cp.ID = 0;

            cp.AddressInfo = new Model.AddressInfo();
            PerformSubmission(cp, null);
        }
    }
}
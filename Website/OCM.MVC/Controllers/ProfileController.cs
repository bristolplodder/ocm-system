﻿using OCM.API.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using OCM.API.Common.Model;

namespace OCM.MVC.Controllers
{
    public class ProfileController : Controller
    {
        //
        // GET: /Profile/

        [AuthSignedInOnly]
        public ActionResult Index()
        {
            if (Session["UserID"] != null)
            {
                UserManager userManager = new UserManager();
                var user = userManager.GetUser(int.Parse(Session["UserID"].ToString()));

                return View(user);
            }
            return View();
        }

        public ActionResult SignIn(string redirectUrl)
        {
            return RedirectToAction("Index", "LoginProvider",
                                    new { _mode = "silent", _forceLogin = true, _redirectUrl = redirectUrl });
        }

        public ActionResult SignOut()
        {
            Session.Abandon();
            return RedirectToAction("Index", "Home");
        }

        [AuthSignedInOnly]
        public ActionResult View(int id)
        {
            UserManager userManager = new UserManager();
            var user = userManager.GetUser(id);
            return View(user);
        }

        [AuthSignedInOnly]
        public ActionResult Edit()
        {
            if (Session["UserID"] != null)
            {
                UserManager userManager = new UserManager();
                var user = userManager.GetUser(int.Parse(Session["UserID"].ToString()));

                return View(user);
            }
            else return View();
        }

        [AuthSignedInOnly]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Edit(User updateProfile)
        {
            if (ModelState.IsValid)
            {
                try
                {
                    if (Session["UserID"] != null)
                    {
                        // TODO: Add update logic here
                        var userManager = new UserManager();
                        var user = userManager.GetUser((int)Session["UserID"]);
                      
                        if (user.ID==updateProfile.ID)
                        { 
                            userManager.UpdateUserProfile(updateProfile, false);
                        }
                        return RedirectToAction("Index");
                    }
                    else return View();
                }
                catch
                {
                    return View();
                }
            }
            return View(updateProfile);
        }
    }
}


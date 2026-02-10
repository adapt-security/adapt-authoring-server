# The temp folder
The `temp` folder (note: this path will vary depending on your local configuration) is, as the name suggests, a temporary store for files used at runtime by the application. These files can be related to any number of things such as file uploads, course builds, documentation builds and so on.

## Using the temp folder
As a module developer, it is recommended that you store any temporary files needed by your module in here. Please be aware however, that due to its non-permanent nature, any data stored in the temp folder has the potential to be removed at any time. We therefore recommend running relevant checks during the startup of your module, and reinitialise any missing files at that point.

It is safe to assume that the temp folder will *not* be removed while the app is running; anyone choosing to do so should expect fatal errors.

## Removing the temp folder
It is perfectly safe to remove the temp folder. You may wish to do this in the event of low disk space, before an update, or even as a regular housekeeping task.

> If you do remove the temp folder, this must be done while the app is stopped, or your users may encounter errors while using the app. Restarting the application will ensure that any vital files are reinstated.
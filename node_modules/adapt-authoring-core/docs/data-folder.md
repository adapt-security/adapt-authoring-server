# The data folder
The data folder is used to store persistant application data and **should not in any circumstances be modified or removed**. Doing so will result in data loss and generally cause unexpected runtime issues.

As a module developer, you should store any data in here which should persist between app restarts. You can make use of the `isDirectory` schema keyword to make configuration simpler for end-users. See the [schemas page](schemas-introduction#isdirectory) for more information.
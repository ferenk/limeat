#!/bin/bash
set -e

export TAGS_COUNT=5
export TARGET_FOLDER=client_versions
export TARGET_SUBFOLDER=client

#get the list of the recent tags (only the ones beginning with a letter and a number, e.g v0.5)
export recent_tags=`git for-each-ref --sort=-creatordate --format '%(refname:short)' refs/tags | head -n $TAGS_COUNT | grep -e '[a-zA-Z][0-9].*'`
echo Recent tags: $recent_tags

# clean the results of the previos execution
rm -rf $TARGET_FOLDER
mkdir $TARGET_FOLDER

# Collect all recently tagged versions
#    Code is based on the following simple, static commands:
#        git --work-tree=client_versions checkout v0.1 -- client
#        mv client_versions/client client_versions/v0.1
for tag in $recent_tags; do \
  echo Getting tag $tag...; \
  git --work-tree=$TARGET_FOLDER checkout $tag -- $TARGET_SUBFOLDER;
  mv $TARGET_FOLDER/$TARGET_SUBFOLDER $TARGET_FOLDER/$tag;
done

echo; echo -n "Creating tar.bz2 archive..."
tar -cjf "$TARGET_FOLDER".tar.bz2 $TARGET_FOLDER
echo " done (verified: `ls "$TARGET_FOLDER".tar.bz2 2>&1`)"


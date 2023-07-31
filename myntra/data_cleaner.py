import os
import csv

cwd = os.getcwd()
articles = os.path.join(cwd, "jsParsers/articles.csv")
articles_cleaned = os.path.join(cwd, "jsParsers/articles_cleaned.csv")

with open(articles) as csvfile:
    with open(articles_cleaned, 'w', newline='') as cleaned_csv:
        reader = csv.DictReader(csvfile)
        writer = csv.DictWriter(cleaned_csv, fieldnames=reader.fieldnames)
        allIds = set()
        for row in reader:
            id = row['id']
            if id not in allIds:
                writer.writerow(row)
                allIds.add(id)

            